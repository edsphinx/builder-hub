// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol"; // Asegúrate de importar esto

/**
 * @title MultiOracleAggregator (UUPS Upgradeable + Trusted Forwarder Compatible)
 * @author blocketh
 * @notice Aggregates multiple oracle feeds and provides average/median pricing with full traceability.
 * @dev Ensure all adapters return 1e18-scaled quotes. Emits events for tracing and deviation validation.
 */
contract MultiOracleAggregator is OwnableUpgradeable, UUPSUpgradeable {
    // ────────────────────────────────────────────────
    // ░░ DATA STRUCTURES
    // ────────────────────────────────────────────────

    /// @notice Address of the trusted forwarder contract
    address private _trustedForwarder;

    /// @notice Structure holding oracle configuration
    struct OracleInfo {
        address oracleAddress;
        bool enabled;
    }

    /// @notice Mapping of base ⇒ quote ⇒ list of oracles
    mapping(address => mapping(address => OracleInfo[])) private _oracles;

    /// @notice Allowed maximum deviation (in basis points)
    uint256 public maxDeviationBps;

    // ────────────────────────────────────────────────
    // ░░ EVENTS
    // ────────────────────────────────────────────────

    /// @notice Emitted when a new oracle is added to a pair
    event OracleAdded(address indexed base, address indexed quote, address oracle);

    /// @notice Emitted when an oracle is removed by index
    event OracleRemoved(address indexed base, address indexed quote, uint256 index);

    /// @notice Emitted when an oracle is toggled (enabled/disabled)
    event OracleToggled(address indexed base, address indexed quote, uint256 index, bool enabled);

    /// @notice Emitted when an oracle is updated
    event OracleUpdated(
        address indexed base,
        address indexed quote,
        uint256 index,
        address oldOracle,
        address newOracle
    );

    /// @notice Emitted when the maximum deviation is updated
    event MaxDeviationUpdated(uint256 bps);

    /// @notice Emitted when a quote is successfully used
    event QuoteUsed(
        address indexed base,
        address indexed quote,
        address oracle,
        uint256 inputAmount, // This parameter is not used in the event.
        uint256 outputQuote
    );

    /// @notice Emitted when a quote is rejected due to deviation
    event QuoteDeviationRejected(
        address indexed base,
        address indexed quote,
        address oracle,
        uint256 inputAmount,
        uint256 quoteValue,
        uint256 referenceQuote
    );

    // ────────────────────────────────────────────────
    // ░░ CONSTRUCTOR / INITIALIZER
    // ────────────────────────────────────────────────

    /**
     * @notice Initializes the contract with the owner and deviation settings
     * @param initialOwner The owner to set
     * @param deviationBps Max allowed deviation in basis points
     */
    function initialize(address initialOwner, uint256 deviationBps) external initializer {
        require(deviationBps <= 10_000, "too high");
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        maxDeviationBps = deviationBps;
    }

    /// @notice Required by UUPS pattern
    function _authorizeUpgrade(address newImplementation) internal view override onlyOwner {}

    /// @dev Ensures both tokens are valid and not equal
    modifier onlyValidPair(address base, address quote) {
        require(base != address(0) && quote != address(0), "zero address");
        require(base != quote, "base = quote");
        _;
    }

    // ────────────────────────────────────────────────
    // ░░ ADMIN: ORACLE CONFIGURATION
    // ────────────────────────────────────────────────

    /**
     * @notice Adds an oracle for a base/quote pair
     * @param base Token being priced
     * @param quote Reference token
     * @param oracle Oracle address
     * @custom:security onlyOwner
     */
    function addOracle(address base, address quote, address oracle) external onlyOwner onlyValidPair(base, quote) {
        require(oracle != address(0), "zero oracle");
        OracleInfo[] storage list = _oracles[base][quote];
        for (uint256 i; i < list.length; i++) require(list[i].oracleAddress != oracle, "duplicate");
        list.push(OracleInfo(oracle, true));
        emit OracleAdded(base, quote, oracle);
    }

    /**
     * @notice Removes an oracle from a pair by index
     * @param base Token being priced
     * @param quote Reference token
     * @param index Oracle index
     * @custom:security onlyOwner
     */
    function removeOracle(address base, address quote, uint256 index) external onlyOwner {
        OracleInfo[] storage list = _oracles[base][quote];
        require(index < list.length, "invalid idx");
        emit OracleRemoved(base, quote, index);
        list[index] = list[list.length - 1];
        list.pop();
    }

    /**
     * @notice Replaces an existing oracle
     * @param base Token being priced
     * @param quote Reference token
     * @param index Oracle index
     * @param newOracle New oracle address
     * @custom:security onlyOwner
     */
    function updateOracle(address base, address quote, uint256 index, address newOracle) external onlyOwner {
        require(newOracle != address(0), "zero oracle");
        OracleInfo[] storage list = _oracles[base][quote];
        require(index < list.length, "invalid idx");
        for (uint256 i; i < list.length; i++) require(list[i].oracleAddress != newOracle, "duplicate");
        address old = list[index].oracleAddress;
        list[index].oracleAddress = newOracle;
        emit OracleUpdated(base, quote, index, old, newOracle);
    }

    /**
     * @notice Enables or disables an oracle
     * @param base Token being priced
     * @param quote Reference token
     * @param index Oracle index
     * @param enabled True to enable, false to disable
     * @custom:security onlyOwner
     */
    function toggleOracle(address base, address quote, uint256 index, bool enabled) external onlyOwner {
        OracleInfo[] storage list = _oracles[base][quote];
        require(index < list.length, "invalid idx");
        list[index].enabled = enabled;
        emit OracleToggled(base, quote, index, enabled);
    }

    /**
     * @notice Sets the maximum deviation allowed between quotes
     * @param bps Deviation in basis points
     * @custom:security onlyOwner
     */
    function setMaxDeviationBps(uint256 bps) external onlyOwner {
        require(bps <= 10_000, "too high");
        maxDeviationBps = bps;
        emit MaxDeviationUpdated(bps);
    }

    // ────────────────────────────────────────────────
    // ░░ READ: QUOTE RETRIEVAL
    // ────────────────────────────────────────────────

    /**
     * @notice Returns average quote after filtering
     * @param amount Input amount
     * @param base Token being priced
     * @param quote Reference token
     * @return Quote in reference token
     */
    function getQuoteAverage(uint256 amount, address base, address quote) external returns (uint256) {
        OracleInfo[] storage list = _oracles[base][quote];
        require(list.length > 0, "no oracles");
        uint256[] memory quotes = new uint256[](list.length);
        uint256 count;

        for (uint256 i; i < list.length; i++) {
            if (!list[i].enabled) continue; // Corrected: Access 'enabled' directly from OracleInfo
            try IPriceOracle(list[i].oracleAddress).getQuote(amount, base, quote) returns (uint256 q) {
                require(q > 0, "zero quote"); // Check for zero quote
                quotes[count++] = q; // Corrected: Access 'oracleAddress' from OracleInfo
                emit QuoteUsed(base, quote, list[i].oracleAddress, amount, q);
            } catch {}
        }

        require(count > 0, "no data");
        uint256 sum;
        for (uint256 i; i < count; i++) sum += quotes[i];
        uint256 avg = sum / count;

        for (uint256 i; i < count; i++) {
            uint256 diff = quotes[i] > avg ? quotes[i] - avg : avg - quotes[i];
            if ((diff * 10_000) / avg > maxDeviationBps) {
                emit QuoteDeviationRejected(base, quote, list[i].oracleAddress, amount, quotes[i], avg);
                revert("deviation too high");
            }
        }
        return avg;
    }

    /** @notice Returns average quote after filtering as view
     *  @param amount Input amount
     *  @param base Token being priced
     *  @param quote Reference token
     *  @return Quote in reference token
     */
    function computeQuoteAverage(uint256 amount, address base, address quote) public view returns (uint256) {
        OracleInfo[] storage list = _oracles[base][quote];
        require(list.length > 0, "no oracles");

        uint256[] memory quotes = new uint256[](list.length);
        uint256 count;

        for (uint256 i; i < list.length; i++) {
            if (!list[i].enabled) continue;
            try IPriceOracle(list[i].oracleAddress).getQuote(amount, base, quote) returns (uint256 q) {
                require(q > 0, "zero quote");
                quotes[count++] = q;
            } catch {}
        }

        require(count > 0, "no data");
        uint256 sum;
        for (uint256 i; i < count; i++) sum += quotes[i];
        uint256 avg = sum / count;

        for (uint256 i; i < count; i++) {
            uint256 diff = quotes[i] > avg ? quotes[i] - avg : avg - quotes[i];
            if ((diff * 10_000) / avg > maxDeviationBps) revert("deviation too high");
        }

        return avg;
    }

    /**
     * @notice Returns median quote after filtering
     * @param amount Input amount
     * @param base Token being priced
     * @param quote Reference token
     * @return Quote in reference token
     */
    function getQuoteMedian(uint256 amount, address base, address quote) external returns (uint256) {
        OracleInfo[] storage list = _oracles[base][quote];
        require(list.length > 0, "no oracles");
        uint256[] memory quotes = new uint256[](list.length);
        uint256 count;

        for (uint256 i; i < list.length; i++) {
            if (!list[i].enabled) continue; // Corrected: Access 'enabled' directly from OracleInfo
            try IPriceOracle(list[i].oracleAddress).getQuote(amount, base, quote) returns (uint256 q) {
                require(q > 0, "zero quote"); // Check for zero quote
                quotes[count++] = q; // Corrected: Access 'oracleAddress' from OracleInfo
                emit QuoteUsed(base, quote, list[i].oracleAddress, amount, q);
            } catch {}
        }

        require(count > 0, "no data");
        uint256[] memory valid = new uint256[](count);
        for (uint256 i; i < count; i++) valid[i] = quotes[i];
        uint256 med = _median(valid);

        for (uint256 i; i < count; i++) {
            uint256 diff = quotes[i] > med ? quotes[i] - med : med - quotes[i];
            if ((diff * 10_000) / med > maxDeviationBps) {
                emit QuoteDeviationRejected(base, quote, list[i].oracleAddress, amount, quotes[i], med);
                revert("deviation too high");
            }
        }
        return med;
    }

    /**
     * @notice Returns median quote after filtering as view
     * @param amount Input amount
     * @param base Token being priced
     * @param quote Reference token
     * @return Quote in reference token
     */
    function computeQuoteMedian(uint256 amount, address base, address quote) public view returns (uint256) {
        OracleInfo[] storage list = _oracles[base][quote];
        require(list.length > 0, "no oracles");
        uint256[] memory quotes = new uint256[](list.length);
        uint256 count;

        for (uint256 i; i < list.length; i++) {
            if (!list[i].enabled) continue; // Corrected: Access 'enabled' directly from OracleInfo
            try IPriceOracle(list[i].oracleAddress).getQuote(amount, base, quote) returns (uint256 q) {
                require(q > 0, "zero quote"); // Check for zero quote
                quotes[count++] = q; // Corrected: Access 'oracleAddress' from OracleInfo
            } catch {}
        }

        require(count > 0, "no data");
        uint256[] memory valid = new uint256[](count);
        for (uint256 i; i < count; i++) valid[i] = quotes[i];
        uint256 med = _median(valid);

        for (uint256 i; i < count; i++) {
            uint256 diff = quotes[i] > med ? quotes[i] - med : med - quotes[i];
            if ((diff * 10_000) / med > maxDeviationBps) {
                revert("deviation too high");
            }
        }
        return med;
    }

    /**
     * @dev Internal method to compute the median value
     * @param arr Array of quote values
     * @return Median value
     */
    function _median(uint256[] memory arr) internal pure returns (uint256) {
        for (uint256 i; i < arr.length; i++) {
            for (uint256 j = i + 1; j < arr.length; j++) {
                if (arr[j] < arr[i]) (arr[i], arr[j]) = (arr[j], arr[i]);
            }
        }
        return arr[arr.length / 2];
    }

    // ────────────────────────────────────────────────
    // ░░ VIEW: ORACLE INSPECTION
    // ────────────────────────────────────────────────

    /**
     * @notice Returns list of registered oracles for a pair
     * @param base Token being priced
     * @param quote Reference token
     * @return Array of OracleInfo structs
     */
    function getOracles(address base, address quote) external view returns (OracleInfo[] memory) {
        return _oracles[base][quote];
    }

    /**
     * @notice Returns the number of oracles for a pair
     * @param base Token being priced
     * @param quote Reference token
     * @return Number of registered oracles
     */
    function oracleCount(address base, address quote) external view returns (uint256) {
        return _oracles[base][quote].length;
    }

    // ────────────────────────────────────────────────
    // ░░ ERC2771ContextUpgradeable: METATRANSACTIONS
    // ────────────────────────────────────────────────

    /// @custom:security ERC2771ContextUpgradeable
    function _msgSender() internal view override returns (address sender) {
        if (isTrustedForwarder(msg.sender)) {
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
        }
    }

    /// @custom:security ERC2771ContextUpgradeable
    function _msgData() internal view override returns (bytes calldata) {
        if (isTrustedForwarder(msg.sender)) {
            return msg.data[:msg.data.length - 20];
        } else {
            return msg.data;
        }
    }

    /// @custom:security ERC2771ContextUpgradeable
    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == _trustedForwarder;
    }
}
