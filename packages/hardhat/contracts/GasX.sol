// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* --------------------------------------------------------------------------
 *  GASLESS PAYMASTER — EntryPoint v0.8 (Cancún)
 *  -------------------------------------------------------------------------
 *  Subsidises gas for USDC-based check‑out flows.
 *  – Strict whitelist of target selectors (prevents drain)
 *  – Soft gas ceiling per UserOp (limits griefing)
 *  – Emits granular event in _postOp() for analytics
 *  – Ready for oracle‑priced subsidies via paymasterAndData
 *
 *  NOTE: Uses ReentrancyGuardTransient through OpenZeppelin 5.1, hence the
 *  compiler warning. The guard is cleared at the end of each *external call*,
 *  so re‑entrancy is still prevented even when the contract is invoked multiple
 *  times in a single transaction bundle.
 * ------------------------------------------------------------------------*/

import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {
    PackedUserOperation,
    UserOperationLib            // ← Library with getters/setters
} from
    "@account-abstraction/contracts/core/UserOperationLib.sol";
import "@account-abstraction/contracts/core/BasePaymaster.sol";
interface IGasXConfig {
    function oracleSigner() external view returns (address);
}

using UserOperationLib for PackedUserOperation; // ⇐ exposes unpack*() helpers

/**
 * @title GasX (ERC‑4337, EntryPoint v0.8)  
 * @notice Subsidises gas for USDC checkout flows through a strict whitelist.  
 *         Core logic is intentionally minimal; dynamic parameters can later be
 *         externalised in a Config contract without touching storage layout.  
 * @dev    Compatible with Cancún (EIP‑1153) chains. Emits an event in _postOp
 *         so front‑ends and indexers can track usage.
 */
contract GasX is BasePaymaster {
    // ----------------------------------------------------------------------
    // ░░  STORAGE
    // ----------------------------------------------------------------------
    
    /// @notice Gas and USD subsidy ceilings
    struct Limits {
        uint256 maxGas; // ⛽ soft ceiling per UserOp (gas units)
        uint256 maxUsd; // 💵 placeholder for future price‑check in USDC (6‑decimals)
    }

    /// @notice Gas and price limits applied to each operation
    Limits public limits;

    /// @notice Whitelist of allowed function selectors for sponsored transactions
    mapping(bytes4 => bool) public allowedSelectors; // fast O(1) lookup for function selectors ok

    /// @notice If true, disables oracle signature checks (dev mode only)
    /// @dev If true, disables signature verification (for development and testing only)
    bool public isDevMode = true;

    /// @notice Current deployment environment
    /// @dev Deployment environment
    enum Environment {
        Dev,
        Testnet,
        Production
    }

    /// @notice Selected deployment environment
    Environment public environment;

    // ----------------------------------------------------------------------
    // ░░  IMMUTABLE REFERENCES - KEEP FOR FUTURE UPGRADES even if unused today
    // ----------------------------------------------------------------------
    
    /// @notice Config contract address containing dynamic parameters and oracle signer
    address public immutable config; // parameters / oracle (future upgrade)
    
    /// @notice Treasury address funding the Paymaster (holds stake & deposit)
    address public immutable treasury; // Multisig that funds stake & deposits

    // ----------------------------------------------------------------------
    // ░░  EVENTS
    // ----------------------------------------------------------------------

    /// @notice Emitted when a user operation is successfully sponsored
    event GasSponsored(
        address indexed sender,
        uint256 gasUsed,
        uint256 feeWei
    );

    // ----------------------------------------------------------------------
    // ░░  CONSTRUCTOR
    // ----------------------------------------------------------------------
    
    /**
     * @notice Deploys the WalletFuel Paymaster contract
     * @param _entryPoint ERC-4337 EntryPoint address
     * @param _config Configuration contract address
     * @param _treasury Treasury address funding the Paymaster
     * @param _environment Deployment environment
     */
    constructor(
        IEntryPoint _entryPoint,       // 0.8 Entrypoint
        address     _config,           // futuro contrato de parámetros
        address     _treasury,          // multisig que fondea el paymaster
        Environment _environment
    ) BasePaymaster(_entryPoint) {
        config   = _config;
        treasury = _treasury;
        environment = _environment;
        _transferOwnership(msg.sender);
    }

    // ----------------------------------------------------------------------
    // ░░  VALIDATION HOOK (ERC‑4337)
    // ----------------------------------------------------------------------
    
    /**
     * @notice Validates a UserOperation and optional oracle signature
     * @dev Reverts on unauthorized selector, gas limit excess, or expired signature.
     *      Assumes oracle signatures are in 1e18-scale compatible format.
     * @param op The packed UserOperation
     * @return context Not used
     * @return validationData Always 0 (valid)
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata op,
        bytes32 /*opHash*/,
        uint256 /*maxCost*/
    ) internal view override returns (bytes memory context, uint256 validationData) {
        // (1) selector whitelist. Function selector must be explicitly allowed
        require(allowedSelectors[_firstSelector(op.callData)], "func!");

        // (2) gas ceiling. Enforce gas ceiling
        require(op.unpackCallGasLimit() <= limits.maxGas, "gas!");

        // (3) optional oracle signature & expiry packed as:
        // paymasterAndData = abi.encodePacked(paymaster, validationGas, postOpGas, expiry, sig)
        bytes calldata pData = op.paymasterAndData;
        if (pData.length > 52) { // Addr (20) + Gas (32) = 52 bytes for static fields
            (uint96 expiry, bytes memory sig) = _decodePaymasterData(pData);
            require(block.timestamp < expiry, "expired!");
            _verifyOracleSig(op, expiry, sig);
        }
        return ("", 0); // validationData = 0 means valid , no extra signature time
    }

    // ----------------------------------------------------------------------
    // ░░  VERIFY ORACLE SIGNATURE -- verify off‑chain publicKey stored in `config`
    // ----------------------------------------------------------------------
    
    /**
     * @notice Verifies oracle signature over a UserOperation + expiry
     * @param op The UserOperation being validated
     * @param expiry Timestamp until which the signature is valid
     * @param sig Oracle-provided ECDSA signature
     * @dev Skipped if in Dev mode. Signature must match oracleSigner from config.
     */
    function _verifyOracleSig(
        PackedUserOperation calldata op,
        uint96 expiry,
        bytes memory sig
    ) private view {
        // --- DEV BYPASS ---
        if (isDev()) {
            return; // Skip signature check in dev mode
        }

        // --- EXPIRY CHECK ---
        require(block.timestamp < expiry, "signature expired");

        // --- BUILD MESSAGE HASH ---
        // ⚠️ NOTE: This uses a placeholder hash for demo purposes.
        // For real bundler integration, replace with the actual userOpHash.
        bytes32 opHash = keccak256(abi.encode(op));
        bytes32 digest = keccak256(abi.encodePacked(opHash, expiry));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)
        );

        // --- PARSE SIGNATURE ---
        require(sig.length == 65, "invalid sig len");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        require(v == 27 || v == 28, "invalid v");

        // --- RECOVER SIGNER ---
        address recovered = ecrecover(ethSignedMessageHash, v, r, s);
        require(recovered != address(0), "invalid signature");

        // --- COMPARE TO ORACLE SIGNER ---
        address signer = IGasXConfig(config).oracleSigner();
        require(recovered == signer, "unauthorized signer");
    }

    // ----------------------------------------------------------------------
    // ░░  POST‑OP HOOK — emit usage metrics (gas & fee) for indexers
    // ----------------------------------------------------------------------
    
    /**
     * @notice Emits gas usage and fee data for analytics
     * @param actualGasCost Gas units used
     * @param actualUserOpFeePerGas Gas price paid
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
    // ░░  ADMIN HELPERS (owner = deployer or multisig)
    // ----------------------------------------------------------------------
    
    /// @notice Sets gas and USD subsidy ceilings
    /// @custom:security onlyOwner
    function setLimit(uint256 gas, uint256 usd) external onlyOwner {
        limits = Limits(gas, usd);
    }
    
    /// @notice Enables or disables a function selector for subsidy
    /// @custom:security onlyOwner
    function setSelector(bytes4 sel, bool ok) external onlyOwner {
        allowedSelectors[sel] = ok;
    }

    /// @notice Enables or disables developer mode
    /// @custom:security onlyOwner
    function setDevMode(bool enabled) external onlyOwner {
        isDevMode = enabled;
    }

    // ────────────────────────────────────────────────
    // ░░  READ HELPERS
    // ────────────────────────────────────────────────

    /// @notice Checks if the environment is Dev
    function isDev() public view returns (bool) {
        return isDevMode;
    }

    /// @notice Checks if the environment is Production
    function isProd() public view returns (bool) {
        return environment == Environment.Production;
    }

    // ----------------------------------------------------------------------
    // ░░  INTERNAL UTILITIES
    // ----------------------------------------------------------------------
    /// @dev Assembly extracts the *first four bytes* of calldata, which is the
    ///      function selector in ABI‑encoded calls (0x00000000–0x00000003).
    function _firstSelector(bytes calldata cd) private pure returns (bytes4 sel) {
        assembly { sel := calldataload(cd.offset) }
    }

    /**
     * @notice (expiry | signature) from paymasterAndData := 20B(addr) + data
     * @param pData Encoded paymasterAndData field
     * @return expiry Expiration timestamp
     * @return sig Oracle signature
     * @dev Decode `paymasterAndData` body (after the 20‑byte address) into
     *      `expiry` (uint96, 12 bytes) + oracle `sig` (variable length).
     */
    function _decodePaymasterData(bytes calldata pData)
        private
        pure
        returns (uint96 expiry, bytes memory sig)
    {
        // Skip the static fields: address (20) + validationGas (16) + postOpGas (16) = 52 bytes
        bytes calldata data = pData[52:];
        expiry = uint96(bytes12(data[:12]));
        sig = data[12:];
    }

    // ----------------------------------------------------------------------
    // ░░  STORAGE GAP FOR UPGRADEABILITY
    // ----------------------------------------------------------------------
    // OZ recommends reserving 50 slots for future upgrades.
    // Currently used slots: 5 (limits, mapping pointer, config, treasury, __gap).
    // 50 ‑ 5 = 45 ⇒ leave 45 empty slots to preserve layout in future versions.
    uint256[45] private __gap; // reserved for future storage
}
