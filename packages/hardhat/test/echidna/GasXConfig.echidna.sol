// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/core/GasXConfig.sol";

/**
 * @title GasXConfig Echidna Invariant Tests
 * @notice Property-based testing for critical invariants
 * @dev Run with: echidna test/echidna/GasXConfig.echidna.sol --contract GasXConfigEchidnaTest
 */
contract GasXConfigEchidnaTest {
    GasXConfig public config;

    // State tracking for invariants
    address public immutable initialOwner;
    address public immutable initialOracleSigner;

    // Track all selectors that have been set
    bytes4[] public setSelectors;
    mapping(bytes4 => bool) public selectorExists;
    mapping(bytes4 => uint256) public lastSetValue;

    // Events for debugging
    event InvariantViolation(string reason);

    constructor() {
        initialOwner = address(this);
        initialOracleSigner = address(0x1111);

        config = new GasXConfig(initialOracleSigner);
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 1: Owner is always immutable (equals deployer)
    // ─────────────────────────────────────────────────────────

    function echidna_owner_is_immutable() public view returns (bool) {
        return config.owner() == initialOwner;
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 2: Oracle signer is never zero address
    // ─────────────────────────────────────────────────────────

    function echidna_oracle_signer_not_zero() public view returns (bool) {
        return config.oracleSigner() != address(0);
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 3: getMaxUsd returns what was set via setMaxUsd
    // ─────────────────────────────────────────────────────────

    function echidna_max_usd_consistent() public view returns (bool) {
        for (uint256 i = 0; i < setSelectors.length; i++) {
            bytes4 selector = setSelectors[i];
            if (config.getMaxUsd(selector) != lastSetValue[selector]) {
                return false;
            }
        }
        return true;
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 4: getAllLimits returns consistent values
    // ─────────────────────────────────────────────────────────

    function echidna_get_all_limits_consistent() public view returns (bool) {
        if (setSelectors.length == 0) return true;

        uint256[] memory limits = config.getAllLimits(setSelectors);

        if (limits.length != setSelectors.length) return false;

        for (uint256 i = 0; i < setSelectors.length; i++) {
            if (limits[i] != lastSetValue[setSelectors[i]]) {
                return false;
            }
        }
        return true;
    }

    // ─────────────────────────────────────────────────────────
    // STATE MUTATIONS (for Echidna to explore)
    // ─────────────────────────────────────────────────────────

    function setOracleSigner(address _newSigner) public {
        if (_newSigner != address(0)) {
            config.setOracleSigner(_newSigner);
        }
    }

    function setMaxUsd(bytes4 _selector, uint256 _maxUsd) public {
        config.setMaxUsd(_selector, _maxUsd);

        // Track the selector and value
        if (!selectorExists[_selector]) {
            setSelectors.push(_selector);
            selectorExists[_selector] = true;
        }
        lastSetValue[_selector] = _maxUsd;
    }

    function bulkSetMaxUsd(bytes4[] calldata _selectors, uint256[] calldata _maxUsds) public {
        if (_selectors.length != _maxUsds.length) return;
        if (_selectors.length > 10) return; // Limit for gas efficiency

        config.bulkSetMaxUsd(_selectors, _maxUsds);

        // Track all selectors and values
        for (uint256 i = 0; i < _selectors.length; i++) {
            bytes4 selector = _selectors[i];
            if (!selectorExists[selector]) {
                setSelectors.push(selector);
                selectorExists[selector] = true;
            }
            lastSetValue[selector] = _maxUsds[i];
        }
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 5: Unset selectors return 0
    // ─────────────────────────────────────────────────────────

    function echidna_unset_selector_returns_zero() public view returns (bool) {
        // Test a selector that was never set
        bytes4 unknownSelector = bytes4(keccak256("unknownFunction()"));

        // Only check if it was never set
        if (selectorExists[unknownSelector]) return true;

        return config.getMaxUsd(unknownSelector) == 0;
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 6: Setting zero is valid (disables subsidy)
    // ─────────────────────────────────────────────────────────

    function echidna_zero_value_allowed() public returns (bool) {
        bytes4 testSelector = bytes4(keccak256("testZeroSelector()"));

        // Set to non-zero first
        config.setMaxUsd(testSelector, 100);

        // Set to zero (should work)
        config.setMaxUsd(testSelector, 0);

        return config.getMaxUsd(testSelector) == 0;
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 7: Max uint256 value is handled correctly
    // ─────────────────────────────────────────────────────────

    function echidna_max_value_handled() public returns (bool) {
        bytes4 testSelector = bytes4(keccak256("testMaxSelector()"));
        uint256 maxValue = type(uint256).max;

        config.setMaxUsd(testSelector, maxValue);

        return config.getMaxUsd(testSelector) == maxValue;
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 8: Empty bulk arrays are handled
    // ─────────────────────────────────────────────────────────

    function echidna_empty_bulk_allowed() public returns (bool) {
        bytes4[] memory emptySelectors = new bytes4[](0);
        uint256[] memory emptyMaxUsds = new uint256[](0);

        // Should not revert
        config.bulkSetMaxUsd(emptySelectors, emptyMaxUsds);

        return true;
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 9: Duplicate selectors in bulk - last value wins
    // ─────────────────────────────────────────────────────────

    function echidna_duplicate_selector_last_wins() public returns (bool) {
        bytes4[] memory selectors = new bytes4[](2);
        uint256[] memory maxUsds = new uint256[](2);

        bytes4 testSelector = bytes4(keccak256("duplicateTest()"));
        selectors[0] = testSelector;
        selectors[1] = testSelector;
        maxUsds[0] = 100;
        maxUsds[1] = 200;

        config.bulkSetMaxUsd(selectors, maxUsds);

        // Last value should win
        return config.getMaxUsd(testSelector) == 200;
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANT 10: Contract state is consistent after operations
    // ─────────────────────────────────────────────────────────

    function echidna_state_consistency() public view returns (bool) {
        // Owner must always be set
        if (config.owner() == address(0)) return false;

        // Oracle signer must always be set
        if (config.oracleSigner() == address(0)) return false;

        return true;
    }
}
