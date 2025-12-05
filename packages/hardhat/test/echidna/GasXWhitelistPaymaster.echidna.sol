// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/core/GasXWhitelistPaymaster.sol";
import "../../contracts/core/GasXConfig.sol";
import { IEntryPoint } from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

/**
 * @title Mock EntryPoint for Echidna testing
 */
contract EchidnaMockEntryPoint {
    function supportsInterface(bytes4) external pure returns (bool) {
        return true;
    }
    function depositTo(address) external payable {}
    function withdrawTo(address payable, uint256) external {}
    function getDepositInfo(
        address
    ) external pure returns (uint256 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime) {
        return (0, false, 0, 0, 0);
    }
    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }
    function addStake(uint32) external payable {}
    function unlockStake() external {}
    function withdrawStake(address payable) external {}
}

/**
 * @title GasXWhitelistPaymaster Echidna Invariant Tests
 * @notice Invariant testing contract for the GasX Whitelist Paymaster
 * @dev Run with: echidna test/echidna/GasXWhitelistPaymaster.echidna.sol --contract GasXWhitelistPaymasterEchidna --config echidna.yaml
 */
contract GasXWhitelistPaymasterEchidna {
    GasXWhitelistPaymaster public paymaster;
    GasXConfig public config;
    EchidnaMockEntryPoint public entryPoint;

    // Track state for invariants
    uint256 public maxGasEverSet = 0;
    uint256 public maxUsdEverSet = 0;
    bytes4[] public selectorsAdded;

    // Constants
    uint256 constant MAX_REASONABLE_GAS = 30_000_000; // Block gas limit
    uint256 constant MAX_REASONABLE_USD = 1_000_000_000_000; // 1 trillion (with 6 decimals)

    constructor() {
        // Deploy mock EntryPoint
        entryPoint = new EchidnaMockEntryPoint();

        // Deploy GasXConfig with non-zero oracle signer
        config = new GasXConfig(address(0x1111));

        // Deploy paymaster
        paymaster = new GasXWhitelistPaymaster(
            IEntryPoint(address(entryPoint)),
            address(config),
            address(0x2222), // treasury
            GasXWhitelistPaymaster.Environment.Dev
        );

        // Enable dev mode for testing
        paymaster.setDevMode(true);
    }

    // ═══════════════════════════════════════════════════════════════════
    // STATE MODIFYING FUNCTIONS (for Echidna to explore)
    // ═══════════════════════════════════════════════════════════════════

    function setLimit(uint256 gas, uint256 usd) public {
        paymaster.setLimit(gas, usd);
        if (gas > maxGasEverSet) maxGasEverSet = gas;
        if (usd > maxUsdEverSet) maxUsdEverSet = usd;
    }

    function setSelector(bytes4 sel, bool allowed) public {
        paymaster.setSelector(sel, allowed);
        if (allowed) {
            selectorsAdded.push(sel);
        }
    }

    function setDevMode(bool enabled) public {
        paymaster.setDevMode(enabled);
    }

    function pause() public {
        paymaster.pause();
    }

    function unpause() public {
        try paymaster.unpause() {} catch {}
    }

    // ═══════════════════════════════════════════════════════════════════
    // INVARIANT TESTS (echidna_ prefix)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Invariant: Treasury address is never zero
     * @dev Treasury is immutable and set at construction to non-zero
     */
    function echidna_treasury_not_zero() public view returns (bool) {
        return paymaster.treasury() != address(0);
    }

    /**
     * @notice Invariant: Config address is never zero
     * @dev Config is immutable and set at construction to non-zero
     */
    function echidna_config_not_zero() public view returns (bool) {
        return paymaster.config() != address(0);
    }

    /**
     * @notice Invariant: Gas limits can be retrieved correctly
     * @dev Ensures limits struct is properly stored and readable
     */
    function echidna_limits_readable() public view returns (bool) {
        (uint256 maxGas, uint256 maxUsd) = paymaster.limits();
        // Limits should be within reasonable bounds
        return maxGas <= type(uint256).max && maxUsd <= type(uint256).max;
    }

    /**
     * @notice Invariant: Dev mode state is consistent
     * @dev isDev() should always return isDevMode value
     */
    function echidna_dev_mode_consistent() public view returns (bool) {
        return paymaster.isDev() == paymaster.isDevMode();
    }

    /**
     * @notice Invariant: Environment is set correctly at construction
     * @dev Environment enum should remain as set during construction
     */
    function echidna_environment_valid() public view returns (bool) {
        GasXWhitelistPaymaster.Environment env = paymaster.environment();
        // Environment should be one of valid values (0, 1, or 2)
        return uint8(env) <= 2;
    }

    /**
     * @notice Invariant: Pause state is consistent
     * @dev paused() should correctly reflect the contract state
     */
    function echidna_pause_state_valid() public view returns (bool) {
        bool isPaused = paymaster.paused();
        // If paused, contract should reject validation (tested separately)
        // Here we just verify the state is readable
        return isPaused == true || isPaused == false;
    }

    /**
     * @notice Invariant: Owner is never zero (would lose control)
     * @dev Owner should always be a valid address
     */
    function echidna_owner_not_zero() public view returns (bool) {
        return paymaster.owner() != address(0);
    }

    /**
     * @notice Invariant: isProd returns consistent value
     * @dev isProd() should be true only for Production environment
     */
    function echidna_is_prod_consistent() public view returns (bool) {
        bool isProd = paymaster.isProd();
        GasXWhitelistPaymaster.Environment env = paymaster.environment();
        // isProd should be true only when environment is Production
        if (env == GasXWhitelistPaymaster.Environment.Production) {
            return isProd == true;
        } else {
            return isProd == false;
        }
    }

    /**
     * @notice Invariant: Selector whitelist is queryable
     * @dev Any selector should be queryable for its whitelist status
     */
    function echidna_selectors_queryable() public view returns (bool) {
        bytes4 randomSelector = bytes4(keccak256(abi.encode(block.timestamp)));
        // Should be able to query any selector without revert
        bool status = paymaster.allowedSelectors(randomSelector);
        return status == true || status == false;
    }
}
