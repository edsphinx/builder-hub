// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { BasePaymaster } from "@account-abstraction/contracts/core/BasePaymaster.sol";
import { UserOperationLib, PackedUserOperation } from "@account-abstraction/contracts/core/UserOperationLib.sol";
import { IEntryPoint } from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { MultiOracleAggregator } from "../oracles/MultiOracleAggregator.sol";

/**
 * @title  GasX ERC20 Fee Paymaster
 * @author edsphinx
 * @notice A paymaster that sponsors gas fees in ETH and charges the user an equivalent fee in a specified ERC20 token (e.g., USDC).
 * @dev    This contract enables users to transact without holding the native gas token (ETH). It uses an off-chain
 * signature for real-time price data and an on-chain oracle for security verification. The token addresses
 * (for the fee and for pricing) are configured at deployment time, making the contract chain-agnostic.
 */
contract GasXERC20FeePaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using UserOperationLib for PackedUserOperation;

    // --- State Variables ---

    /// @notice The ERC20 token used to pay fees (e.g., USDC).
    address public immutable feeToken;
    /// @notice The token used as the base for price quotes (e.g., WETH).
    address public immutable priceQuoteBaseToken;
    /// @notice The on-chain price oracle for ETH/FeeToken.
    MultiOracleAggregator public immutable priceOracle;
    /// @notice The address of the off-chain service authorized to sign prices.
    address public oracleSigner;

    /// @notice The maximum allowed deviation between the off-chain signed price and the on-chain oracle price.
    uint256 public constant PRICE_DEVIATION_BPS = 500; // 5%

    // --- Events ---

    event OracleSignerUpdated(address indexed newSigner);
    event FeeCharged(bytes32 indexed userOpHash, address indexed user, uint256 feeAmount);

    // --- Constructor ---

    constructor(
        IEntryPoint _entryPoint,
        address _feeToken,
        address _priceQuoteBaseToken,
        address _priceOracle,
        address _initialOracleSigner
    ) BasePaymaster(_entryPoint) {
        _transferOwnership(msg.sender);
        feeToken = _feeToken;
        priceQuoteBaseToken = _priceQuoteBaseToken;
        priceOracle = MultiOracleAggregator(_priceOracle);
        oracleSigner = _initialOracleSigner;
    }

    // --- Validation Logic ---

    function _validatePaymasterUserOp(
        PackedUserOperation calldata op,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal view override returns (bytes memory context, uint256 validationData) {
        // 1. Decode off-chain data from paymasterAndData
        (uint256 offChainPrice, uint48 expiry, bytes memory signature) = _decodePaymasterData(op.paymasterAndData);

        // 2. Verify expiry
        require(block.timestamp < expiry, "GasX: Signature expired");

        // 3. Verify off-chain price signature
        bytes32 priceHash = keccak256(abi.encode(userOpHash, offChainPrice, expiry));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(priceHash);
        require(ECDSA.recover(ethSignedHash, signature) == oracleSigner, "GasX: Invalid signature");

        // 4. Security Check: Verify price against on-chain oracle
        uint256 onChainPrice = priceOracle.computeQuoteAverage(1e18, priceQuoteBaseToken, feeToken);
        require(onChainPrice > 0, "GasX: Invalid on-chain price");
        uint256 diff = onChainPrice > offChainPrice ? onChainPrice - offChainPrice : offChainPrice - onChainPrice;
        require((diff * 10_000) / onChainPrice <= PRICE_DEVIATION_BPS, "GasX: Price deviation too high");

        // 5. Calculate required fee and pack context for _postOp
        uint256 requiredFee = (maxCost * onChainPrice) / 1e18;

        // Ensure the user has enough allowance
        require(IERC20(feeToken).allowance(op.sender, address(this)) >= requiredFee, "GasX: Insufficient allowance");

        // Pass the calculated on-chain price and the sender to postOp via context
        context = abi.encode(onChainPrice, op.sender);

        return (context, 0);
    }

    // --- Post-Op Payment ---

    function _postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost, uint256) internal override {
        if (mode != PostOpMode.opSucceeded) return;

        // Decode the price and sender address from the context set in the validation phase
        (uint256 onChainPrice, address sender) = abi.decode(context, (uint256, address));

        // Recalculate the fee with the actual gas cost to be fair to the user
        uint256 actualFee = (actualGasCost * onChainPrice) / 1e18;

        // Collect the fee
        IERC20(feeToken).transferFrom(sender, address(this), actualFee);

        // It's good practice to get the userOpHash here if possible for the event
        // Note: Accessing userOpHash in postOp is complex, this is a simplification
        emit FeeCharged(bytes32(0), sender, actualFee);
    }

    // --- Admin Functions ---

    function setOracleSigner(address _newSigner) external onlyOwner {
        oracleSigner = _newSigner;
        emit OracleSignerUpdated(_newSigner);
    }

    // --- Helper Functions ---

    function _decodePaymasterData(
        bytes calldata pData
    ) private pure returns (uint256 price, uint48 expiry, bytes memory signature) {
        // Skip the static 52 bytes (address + gas limits)
        bytes calldata data = pData[52:];
        require(data.length >= 32 + 6, "GasX: Invalid paymaster data length");

        price = abi.decode(data[:32], (uint256));
        expiry = uint48(bytes6(data[32:38]));
        signature = data[38:];
    }
}
