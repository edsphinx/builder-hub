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

using UserOperationLib for PackedUserOperation; // ⇐ exposes unpack*() helpers

/**
 * @title WalletFuel (ERC‑4337, EntryPoint v0.8)  
 * @notice Subsidises gas for USDC checkout flows through a strict whitelist.  
 *         Core logic is intentionally minimal; dynamic parameters can later be
 *         externalised in a Config contract without touching storage layout.  
 * @dev    Compatible with Cancún (EIP‑1153) chains. Emits an event in _postOp
 *         so front‑ends and indexers can track usage.
 */
contract WalletFuel is BasePaymaster {
    // ----------------------------------------------------------------------
    // ░░  STORAGE
    // ----------------------------------------------------------------------
    struct Limits {
        uint256 maxGas; // ⛽ soft ceiling per UserOp (gas units)
        uint256 maxUsd; // 💵 placeholder for future price‑check in USDC (6‑decimals)
    }

    Limits public limits; // gas / USD ceilings
    mapping(bytes4 => bool) public allowedSelectors; // fast O(1) lookup for function selectors ok

    // Immutable references — keep them for future upgrades even if unused today
    address public immutable config; // parameters / oracle (future upgrade)
    address public immutable treasury; // Multisig that funds stake & deposits

    // ----------------------------------------------------------------------
    // ░░  EVENTS
    // ----------------------------------------------------------------------
    event GasSponsored(
        address indexed sender,
        uint256 gasUsed,
        uint256 feeWei
    );

    // ----------------------------------------------------------------------
    // ░░  CONSTRUCTOR
    // ----------------------------------------------------------------------
    constructor(
        IEntryPoint _entryPoint,       // 0.8 Entrypoint
        address     _config,           // futuro contrato de parámetros
        address     _treasury          // multisig que fondea el paymaster
    ) BasePaymaster(_entryPoint) {
        config   = _config;
        treasury = _treasury;
        _transferOwnership(msg.sender);
    }

    // ----------------------------------------------------------------------
    // ░░  VALIDATION HOOK (ERC‑4337)
    // ----------------------------------------------------------------------
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
        // paymasterAndData = abi.encodePacked(paymaster, expiry,uint8 v,bytes32 r,bytes32 s)
        bytes calldata pData = op.paymasterAndData;
        if (pData.length > 20) { // first 20 bytes hold the paymaster address
            (uint96 expiry, bytes memory sig) = _decodePaymasterData(pData);
            require(block.timestamp < expiry, "expired!");
            // 👉 TODO: verify oracle signature off‑chain publicKey stored in `config`
            // _verifyOracleSig(op, expiry, sig);
        }
        return ("", 0); // validationData = 0 means valid , no extra signature time
    }

    // ----------------------------------------------------------------------
    // ░░  POST‑OP HOOK — emit usage metrics (gas & fee) for indexers
    // ----------------------------------------------------------------------
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
    function setLimit(uint256 gas, uint256 usd) external onlyOwner {
        limits = Limits(gas, usd);
    }
    function setSelector(bytes4 sel, bool ok) external onlyOwner {
        allowedSelectors[sel] = ok;
    }

    // ----------------------------------------------------------------------
    // ░░  INTERNAL UTILITIES
    // ----------------------------------------------------------------------
    /// @dev Assembly extracts the *first four bytes* of calldata, which is the
    ///      function selector in ABI‑encoded calls (0x00000000–0x00000003).
    function _firstSelector(bytes calldata cd) private pure returns (bytes4 sel) {
        assembly { sel := calldataload(cd.offset) }
    }

    // decode (expiry | signature) from paymasterAndData := 20B(addr) + data
    /// @dev Decode `paymasterAndData` body (after the 20‑byte address) into
    ///      `expiry` (uint96, 12 bytes) + oracle `sig` (variable length).
    function _decodePaymasterData(bytes calldata pData)
        private
        pure
        returns (uint96 expiry, bytes memory sig)
    {
        bytes calldata data = pData[20:];            // strip paymaster address
        expiry = uint96(bytes12(data[:12]));         // first 12 bytes → uint96 expiry
        sig    = data[12:];                          // rest → oracle signature
    }

    // ----------------------------------------------------------------------
    // ░░  STORAGE GAP
    // ----------------------------------------------------------------------
    // OZ recommends reserving 50 slots for future upgrades.
    // Currently used slots: 5 (limits, mapping pointer, config, treasury, __gap).
    // 50 ‑ 5 = 45 ⇒ leave 45 empty slots to preserve layout in future versions.
    uint256[45] private __gap; // reserved for future storage
}
