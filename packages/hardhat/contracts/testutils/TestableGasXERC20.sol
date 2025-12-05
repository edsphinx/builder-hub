// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/GasXERC20FeePaymaster.sol";

/// @title TestableGasXERC20
/// @notice Exposes internal GasXERC20FeePaymaster functions for unit testing purposes.
contract TestableGasXERC20 is GasXERC20FeePaymaster {
    constructor(
        IEntryPoint _entryPoint,
        address _feeToken,
        address _priceQuoteBaseToken,
        address _priceOracle,
        address _initialOracleSigner,
        uint256 _minFee,
        uint256 _feeMarkupBps
    )
        GasXERC20FeePaymaster(
            _entryPoint,
            _feeToken,
            _priceQuoteBaseToken,
            _priceOracle,
            _initialOracleSigner,
            _minFee,
            _feeMarkupBps
        )
    {}

    /// @notice Exposes the validation logic for tests
    function exposedValidate(
        PackedUserOperation calldata op,
        bytes32 opHash,
        uint256 maxCost
    ) external view returns (bytes memory ctx, uint256 vd) {
        return _validatePaymasterUserOp(op, opHash, maxCost);
    }

    /// @notice Exposes the postOp logic for tests
    function exposedPostOp(bytes calldata context, uint256 actualGasCost, uint256 feePerGas) external {
        _postOp(PostOpMode.opSucceeded, context, actualGasCost, feePerGas);
    }

    /// @notice Exposes postOp with failed mode for tests
    function exposedPostOpFailed(bytes calldata context, uint256 actualGasCost, uint256 feePerGas) external {
        _postOp(PostOpMode.opReverted, context, actualGasCost, feePerGas);
    }

    /// @notice Helper to generate valid paymaster data for testing
    /// @dev Uses bytes.concat to avoid abi.encodePacked collision with dynamic types
    function encodePaymasterData(
        uint256 price,
        uint48 expiry,
        bytes memory signature
    ) external view returns (bytes memory) {
        // paymasterAndData structure:
        // - 20 bytes: paymaster address
        // - 16 bytes: verificationGasLimit (packed)
        // - 16 bytes: postOpGasLimit (packed)
        // - 32 bytes: price
        // - 6 bytes: expiry
        // - variable: signature

        return bytes.concat(
            bytes20(address(this)),           // 20 bytes: paymaster address
            bytes16(uint128(100000)),         // 16 bytes: verificationGasLimit
            bytes16(uint128(100000)),         // 16 bytes: postOpGasLimit
            bytes32(price),                   // 32 bytes: price
            bytes6(expiry),                   // 6 bytes: expiry
            signature                         // variable: signature
        );
    }
}
