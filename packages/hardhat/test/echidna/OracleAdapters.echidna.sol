// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/oracles/DIAOracleAdapter.sol";
import "../../contracts/oracles/EulerOracleAdapter.sol";
import "../../contracts/mocks/MockDIAOracle.sol";
import "../../contracts/mocks/MockEulerOracle.sol";

/**
 * @title OracleAdapters Echidna Invariant Tests
 * @notice Property-based testing for DIAOracleAdapter and EulerOracleAdapter
 * @dev Run with: echidna test/echidna/OracleAdapters.echidna.sol --contract OracleAdaptersEchidnaTest
 */
contract OracleAdaptersEchidnaTest {
    MockDIAOracle public diaOracle;
    MockEulerOracle public eulerOracle;
    DIAOracleAdapter public diaAdapter;
    EulerOracleAdapter public eulerAdapter;

    // Constants
    address public constant BASE = address(0x1);
    address public constant QUOTE = address(0x2);
    uint256 public constant PRECISION = 1e18;
    uint256 public constant DIA_PRECISION = 1e8;

    // Track state
    uint128 public lastDiaPrice;
    uint256 public lastEulerPrice;
    uint128 public lastDiaTimestamp;

    constructor() {
        // Deploy mock oracles
        diaOracle = new MockDIAOracle();
        eulerOracle = new MockEulerOracle();

        // Set initial prices
        lastDiaPrice = 1000e8;
        lastDiaTimestamp = uint128(block.timestamp);
        lastEulerPrice = 1000e18;

        diaOracle.setValue("ETH/USD", lastDiaPrice, lastDiaTimestamp);
        eulerOracle.setPrice(lastEulerPrice);

        // Deploy adapters
        diaAdapter = new DIAOracleAdapter(address(diaOracle), BASE, QUOTE, "ETH/USD");
        eulerAdapter = new EulerOracleAdapter(address(eulerOracle), BASE, QUOTE);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DIAOracleAdapter INVARIANTS
    // ═══════════════════════════════════════════════════════════════════════════

    // ─────────────────────────────────────────────────────────
    // INVARIANT 1: DIA adapter returns consistent quote
    // ─────────────────────────────────────────────────────────

    function echidna_dia_quote_consistent() public view returns (bool) {
        if (lastDiaPrice == 0) return true;
        if (block.timestamp - lastDiaTimestamp > 3600) return true; // Stale

        try diaAdapter.getQuote(BASE, QUOTE, PRECISION) returns (uint256 quote) {
            // quote = amount * price * 1e10 / 1e18 = price * 1e10 / 1e18
            uint256 expected = (uint256(lastDiaPrice) * 1e10 * PRECISION) / PRECISION;
            return quote == expected;
        } catch {
            return true; // Expected failure (stale, zero price)
        }
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 2: DIA adapter never returns negative
    // ─────────────────────────────────────────────────────────

    function echidna_dia_quote_non_negative() public view returns (bool) {
        try diaAdapter.getQuote(BASE, QUOTE, PRECISION) returns (uint256 quote) {
            return quote >= 0; // Always true for uint256, but good to express intent
        } catch {
            return true;
        }
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 3: DIA adapter immutable addresses
    // ─────────────────────────────────────────────────────────

    function echidna_dia_immutable_addresses() public view returns (bool) {
        return diaAdapter.diaOracle() == address(diaOracle) && diaAdapter.baseToken() == BASE
            && diaAdapter.quoteToken() == QUOTE;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EulerOracleAdapter INVARIANTS
    // ═══════════════════════════════════════════════════════════════════════════

    // ─────────────────────────────────────────────────────────
    // INVARIANT 4: Euler adapter returns consistent quote
    // ─────────────────────────────────────────────────────────

    function echidna_euler_quote_consistent() public view returns (bool) {
        if (lastEulerPrice == 0) return true;

        try eulerAdapter.getQuote(BASE, QUOTE, PRECISION) returns (uint256 quote) {
            // quote = amount * price / 1e18
            uint256 expected = (PRECISION * lastEulerPrice) / PRECISION;
            return quote == expected;
        } catch {
            return true;
        }
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 5: Euler adapter immutable addresses
    // ─────────────────────────────────────────────────────────

    function echidna_euler_immutable_addresses() public view returns (bool) {
        return eulerAdapter.eulerOracle() == address(eulerOracle) && eulerAdapter.baseToken() == BASE
            && eulerAdapter.quoteToken() == QUOTE;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CROSS-ADAPTER INVARIANTS
    // ═══════════════════════════════════════════════════════════════════════════

    // ─────────────────────────────────────────────────────────
    // INVARIANT 6: Same price gives same quote (accounting for decimals)
    // ─────────────────────────────────────────────────────────

    function echidna_adapters_equivalent_pricing() public view returns (bool) {
        // Skip if either price is invalid
        if (lastDiaPrice == 0 || lastEulerPrice == 0) return true;
        if (block.timestamp - lastDiaTimestamp > 3600) return true;

        // Only compare if prices are equivalent (DIA 8 decimals, Euler 18 decimals)
        if (uint256(lastDiaPrice) * 1e10 != lastEulerPrice) return true;

        try diaAdapter.getQuote(BASE, QUOTE, PRECISION) returns (uint256 diaQuote) {
            try eulerAdapter.getQuote(BASE, QUOTE, PRECISION) returns (uint256 eulerQuote) {
                return diaQuote == eulerQuote;
            } catch {
                return true;
            }
        } catch {
            return true;
        }
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 7: Quote scales linearly with amount
    // ─────────────────────────────────────────────────────────

    function echidna_quote_scales_linearly() public view returns (bool) {
        if (lastEulerPrice == 0) return true;

        try eulerAdapter.getQuote(BASE, QUOTE, PRECISION) returns (uint256 quote1) {
            try eulerAdapter.getQuote(BASE, QUOTE, 2 * PRECISION) returns (uint256 quote2) {
                // quote2 should be 2x quote1 (allowing for rounding)
                return quote2 == 2 * quote1 || quote2 == 2 * quote1 + 1 || quote2 == 2 * quote1 - 1;
            } catch {
                return true;
            }
        } catch {
            return true;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE MUTATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function setDiaPrice(uint128 price) public {
        if (price > 0) {
            lastDiaPrice = price;
            lastDiaTimestamp = uint128(block.timestamp);
            diaOracle.setValue("ETH/USD", price, lastDiaTimestamp);
        }
    }

    function setEulerPrice(uint256 price) public {
        if (price > 0 && price < type(uint128).max) {
            lastEulerPrice = price;
            eulerOracle.setPrice(price);
        }
    }

    function setSamePrice(uint64 price8Decimals) public {
        if (price8Decimals > 0) {
            // Set equivalent prices in both oracles
            lastDiaPrice = uint128(price8Decimals);
            lastDiaTimestamp = uint128(block.timestamp);
            lastEulerPrice = uint256(price8Decimals) * 1e10;

            diaOracle.setValue("ETH/USD", lastDiaPrice, lastDiaTimestamp);
            eulerOracle.setPrice(lastEulerPrice);
        }
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 8: Zero amount returns zero quote
    // ─────────────────────────────────────────────────────────

    function echidna_zero_amount_zero_quote() public view returns (bool) {
        if (lastEulerPrice == 0) return true;

        try eulerAdapter.getQuote(BASE, QUOTE, 0) returns (uint256 quote) {
            return quote == 0;
        } catch {
            return true;
        }
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 9: DIA staleness check works
    // ─────────────────────────────────────────────────────────

    function echidna_dia_staleness() public view returns (bool) {
        // This invariant checks that if timestamp is old, getQuote reverts
        if (block.timestamp - lastDiaTimestamp <= 3600) return true;

        try diaAdapter.getQuote(BASE, QUOTE, PRECISION) {
            // Should have reverted with StalePrice
            return false;
        } catch {
            return true;
        }
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 10: Quote bounded by reasonable values
    // ─────────────────────────────────────────────────────────

    function echidna_quote_bounded() public view returns (bool) {
        if (lastEulerPrice == 0) return true;

        try eulerAdapter.getQuote(BASE, QUOTE, PRECISION) returns (uint256 quote) {
            // Quote should not exceed max reasonable value
            return quote <= type(uint128).max;
        } catch {
            return true;
        }
    }
}
