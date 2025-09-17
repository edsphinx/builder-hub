// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* --------------------------------------------------------------------------
 * GASX WHITELIST PAYMASTER — FOR ENTRYPOINT v0.8+
 * -------------------------------------------------------------------------
 * Provides full gas sponsorship for specific, whitelisted function calls.
 *
 * - Core Security: A strict whitelist of function selectors prevents unauthorized use.
 * - Griefing Protection: A configurable gas ceiling per UserOperation limits potential abuse.
 * - Analytics: Emits a detailed `GasSponsored` event in `_postOp` for off-chain tracking.
 * - Extensibility: Supports optional, time-bound oracle signatures for dynamic,
 *   off-chain validation rules.
 * ------------------------------------------------------------------------*/

import { IEntryPoint } from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import { PackedUserOperation, UserOperationLib } from "@account-abstraction/contracts/core/UserOperationLib.sol";
import "@account-abstraction/contracts/core/BasePaymaster.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IGasXConfig {
    function oracleSigner() external view returns (address);
}

/**
 * @title  GasX Whitelist Paymaster
 * @author edsphinx
 * @notice A paymaster that provides full gas sponsorship for UserOperations that call
 * a function on a pre-approved whitelist. This is ideal for subsidizing
 * specific, critical user actions like onboarding, profile creation, or
 * participating in promotional events.
 * @dev    This contract implements the ERC-4337 `BasePaymaster` for EntryPoint v0.8+.
 * It uses a strict function selector whitelist and a global gas limit per
 * operation as its primary security mechanisms. Off-chain oracle signatures can
 * be optionally required for more dynamic, time-sensitive approvals. The contract
 * is designed with a storage gap for future upgradeability.
 */
contract GasXWhitelistPaymaster is BasePaymaster {
    using UserOperationLib for PackedUserOperation; // ⇐ exposes unpack*() helpers
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    // ----------------------------------------------------------------------
    //  STORAGE
    // ----------------------------------------------------------------------

    /// @notice Defines the gas and (future) USD subsidy ceilings per operation.
    struct Limits {
        uint256 maxGas; // The maximum amount of gas that will be sponsored for a single UserOp.
        uint256 maxUsd; // A placeholder for future, more complex validation logic (e.g., USD-based limits). Not currently enforced.
    }

    /// @notice The currently enforced gas limits for sponsored operations.
    Limits public limits;

    /// @notice A mapping of `bytes4` function selectors to a boolean indicating if they are approved for sponsorship.
    mapping(bytes4 => bool) public allowedSelectors; // fast O(1) lookup for function selectors ok

    /// @notice If true, oracle signature validation is bypassed. For development and testing ONLY.
    bool public isDevMode = true;

    /// @notice The deployment environment context for this contract.
    enum Environment {
        Dev,
        Testnet,
        Production
    }

    /// @notice The configured deployment environment.
    Environment public environment;

    // ----------------------------------------------------------------------
    //  IMMUTABLE REFERENCES
    // ----------------------------------------------------------------------

    /// @notice The address of the GasXConfig contract, which holds dynamic parameters like the oracle signer address.
    address public immutable config;

    /// @notice The address of the treasury that funds this paymaster's stake and gas deposit with the EntryPoint.
    address public immutable treasury; // Multisig that funds stake & deposits

    // ----------------------------------------------------------------------
    // ░░  EVENTS
    // ----------------------------------------------------------------------

    /// @notice Emitted when a UserOperation has been successfully sponsored and executed.
    event GasSponsored(
        address indexed sender, // The sender of the sponsored UserOperation.
        uint256 gasUsed, // The actual gas consumed by the operation.
        uint256 feeWei // The total fee in Wei paid by the paymaster (gasUsed * gasPrice).
    );

    // ----------------------------------------------------------------------
    // ░░  CONSTRUCTOR
    // ----------------------------------------------------------------------

    /**
     * @notice Deploys the GasX Whitelist Paymaster contract.
     * @param _entryPoint The address of the ERC-4337 EntryPoint contract.
     * @param _config The address of the GasXConfig contract.
     * @param _treasury The address of the treasury that will fund this paymaster.
     * @param _environment The deployment environment (Dev, Testnet, or Production).
     */
    constructor(
        IEntryPoint _entryPoint, // 0.8 Entrypoint
        address _config, // futuro contrato de parámetros
        address _treasury, // multisig que fondea el paymaster
        Environment _environment
    ) BasePaymaster(_entryPoint) {
        config = _config;
        treasury = _treasury;
        environment = _environment;
        _transferOwnership(msg.sender);
    }

    // ----------------------------------------------------------------------
    // ░░  VALIDATION HOOK (ERC‑4337)
    // ----------------------------------------------------------------------

    /**
     * @notice Validates a UserOperation to determine if it should be sponsored.
     * @dev    This function is called by the EntryPoint during the validation phase. It reverts if the
     * UserOperation is not eligible for sponsorship. The main checks are:
     * 1. The function selector in `op.callData` must be on the `allowedSelectors` whitelist.
     * 2. The `callGasLimit` must not exceed `limits.maxGas`.
     * 3. If `paymasterAndData` includes a signature, it must be valid and not expired.
     * @param op The PackedUserOperation to validate.
     * @param opHash The hash of the UserOperation.
     * @return context This contract does not use context, so it returns an empty bytes string.
     * @return validationData A timestamp until which the EntryPoint will not require signatures again for this UserOp.
     * Returns 0 to indicate validity without special signature handling.
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata op,
        bytes32 opHash,
        uint256 /*maxCost*/
    ) internal view override returns (bytes memory context, uint256 validationData) {
        // (1) Selector Whitelist Check
        require(allowedSelectors[_firstSelector(op.callData)], "GasX: Disallowed function");

        // (2) Gas Ceiling Check
        require(op.unpackCallGasLimit() <= limits.maxGas, "GasX: Gas limit exceeded");

        // (3) optional oracle signature & expiry packed as:
        // paymasterAndData = abi.encodePacked(paymaster, validationGas, postOpGas, expiry, sig)
        bytes calldata pData = op.paymasterAndData;
        if (pData.length > 52) {
            // Standard length for paymaster address (20) + packed gas limits (32)
            (uint48 expiry, bytes memory sig) = _decodePaymasterData(pData);
            require(block.timestamp < expiry, "expired!");
            _verifyOracleSig(opHash, expiry, sig);
        }
        return ("", 0); // validationData = 0 means valid , no extra signature time
    }

    // ----------------------------------------------------------------------
    //  INTERNAL LOGIC
    // ----------------------------------------------------------------------

    /**
     * @notice Verifies an oracle signature over a UserOperation hash and expiry timestamp.
     * @param opHash The hash of the UserOperation being validated.
     * @param expiry The UNIX timestamp until which the signature is valid.
     * @param sig The ECDSA signature provided by the off-chain oracle service.
     * @dev    This check is skipped if `isDevMode` is true. The signature must be an Ethereum
     * signed message hash (`\x19Ethereum Signed Message:\n32`) over the packed `(opHash, expiry)`.
     * The signer's address is retrieved from the `GasXConfig` contract.
     */
    function _verifyOracleSig(bytes32 opHash, uint48 expiry, bytes memory sig) private view {
        if (isDev()) {
            return;
        }

        bytes32 digest = keccak256(abi.encodePacked(opHash, expiry));

        // Prepare the hash according to EIP-191 standard
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(digest);

        // Recover the signer address from the signature and prepared hash
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, sig);

        require(recoveredSigner != address(0), "GasX: Invalid signature");

        address expectedSigner = IGasXConfig(config).oracleSigner();
        require(recoveredSigner == expectedSigner, "GasX: Unauthorized signer");
    }

    /**
     * @notice Emits a `GasSponsored` event for analytics and tracking purposes.
     * @dev    This function is called by the EntryPoint after a successful UserOperation execution. It allows
     * off-chain services to easily monitor gas consumption and total sponsorship costs.
     * @param actualGasCost The actual amount of gas used by the UserOperation.
     * @param actualUserOpFeePerGas The actual gas price paid for the transaction.
     */
    function _postOp(
        PostOpMode /*mode*/,
        bytes calldata /*context*/,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal override {
        emit GasSponsored(msg.sender, actualGasCost, actualGasCost * actualUserOpFeePerGas);
    }

    // ----------------------------------------------------------------------
    // ADMIN FUNCTIONS
    // ----------------------------------------------------------------------

    /**
     * @notice Sets the maximum gas to be sponsored per UserOperation.
     * @custom:security onlyOwner
     * @param gas The new gas limit in gas units.
     * @param usd A placeholder for future use (currently not enforced).
     */
    function setLimit(uint256 gas, uint256 usd) external onlyOwner {
        limits = Limits(gas, usd);
    }

    /**
     * @notice Adds or removes a function selector from the sponsorship whitelist.
     * @custom:security onlyOwner
     * @param sel The 4-byte function selector to update.
     * @param allowed True to add to the whitelist, false to remove.
     */
    function setSelector(bytes4 sel, bool allowed) external onlyOwner {
        allowedSelectors[sel] = allowed;
    }

    /**
     * @notice Enables or disables the developer mode, which bypasses oracle signature checks.
     * @custom:security onlyOwner
     * @param enabled True to enable dev mode, false to disable.
     */
    function setDevMode(bool enabled) external onlyOwner {
        isDevMode = enabled;
    }

    // ────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ────────────────────────────────────────────────

    /// @notice Returns true if the contract is currently in developer mode.
    function isDev() public view returns (bool) {
        return isDevMode;
    }

    /// @notice Returns true if the contract is configured for the Production environment.
    function isProd() public view returns (bool) {
        return environment == Environment.Production;
    }

    // ----------------------------------------------------------------------
    // INTERNAL UTILITIES
    // ----------------------------------------------------------------------

    /// @dev Extracts the first four bytes (the function selector) from calldata using assembly for efficiency.
    function _firstSelector(bytes calldata cd) private pure returns (bytes4 sel) {
        assembly {
            sel := calldataload(cd.offset)
        }
    }

    /**
     * @notice Decodes the expiry and signature from the `paymasterAndData` field.
     * @dev    The data is expected to be packed after the first 52 bytes (20-byte paymaster address
     * + 32-byte packed gas limits). The layout is `expiry (uint48)` followed by `signature (bytes)`.
     * @param pData The full `paymasterAndData` bytes string from the UserOperation.
     * @return expiry The 6-byte expiration timestamp (uint48).
     * @return sig The variable-length oracle signature.
     */
    function _decodePaymasterData(bytes calldata pData) private pure returns (uint48 expiry, bytes memory sig) {
        // Skip the static fields: address (20) + validationGas (16) + postOpGas (16) = 52 bytes
        bytes calldata data = pData[52:];
        require(data.length >= 6, "invalid paymaster data length for expiry");
        expiry = uint48(bytes6(data[:6]));
        sig = data[6:];
    }
}
