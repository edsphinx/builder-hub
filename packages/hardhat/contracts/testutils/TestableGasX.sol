// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../GasX.sol";

/// @title TestableGasX
/// @notice Exposes internal GasX functions for unit testing purposes.
contract TestableGasX is GasX {
    constructor(address ep, address cfg, address treas) GasX(IEntryPoint(ep), cfg, treas, environment) {}

    /// @notice expone la validación internamente para tests
    function exposedValidate(
        PackedUserOperation calldata op,
        bytes32 opHash,
        uint256 maxCost
    ) external view returns (bytes memory ctx, uint256 vd) {
        return _validatePaymasterUserOp(op, opHash, maxCost);
    }

    function exposedPostOp(bytes calldata context, uint256 gasCost, uint256 feePerGas) external {
        _postOp(PostOpMode.opSucceeded, context, gasCost, feePerGas);
    }
}
