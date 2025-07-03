// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../WalletFuel.sol";

contract TestableWalletFuel is WalletFuel {
    constructor(address ep, address cfg, address treas) WalletFuel(IEntryPoint(ep), cfg, treas, environment) {}

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
