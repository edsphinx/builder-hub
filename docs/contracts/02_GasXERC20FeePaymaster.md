# Contract Reference: `GasXERC20FeePaymaster.sol`

This document provides a detailed technical reference for the `GasXERC20FeePaymaster` contract.

- **Source Code:** [`contracts/core/GasXERC20FeePaymaster.sol`](../../contracts/core/GasXERC20FeePaymaster.sol)
- **Type:** ERC-4337 Paymaster

## 1. Overview

The `GasXERC20FeePaymaster` is a smart contract that enables users to pay for their transaction gas fees using a designated ERC20 token (like USDC) instead of the chain's native token (ETH).

The contract sponsors the `UserOperation` by paying the gas in ETH from its own deposit and then, in the `_postOp` hook, collects an equivalent amount of the ERC20 token from the user. This creates a seamless experience for users who primarily hold stablecoins or other tokens.

## 2. Core Logic (`_validatePaymasterUserOp`)

This paymaster's validation is more complex as it relies on a secure off-chain/on-chain hybrid model to determine the correct fee.

1.  **Decode `paymasterAndData`:** The function first decodes the data provided by the user's dApp, which must include a real-time price quote, an expiry timestamp, and a signature from the trusted off-chain Oracle Signer.
2.  **Verify Signature & Expiry:** It validates that the signature is from the authorized `oracleSigner` (defined in `GasXConfig`) and that the timestamp has not expired.
3.  **On-Chain Price Verification:** As a critical security step, it fetches a fresh price from the on-chain `MultiOracleAggregator`. It compares this on-chain price to the signed off-chain price. If the deviation is too large, it reverts to protect against a compromised signer.
4.  **Check User Allowance:** It verifies that the user has given the paymaster a sufficient ERC20 allowance to cover the maximum potential cost of the transaction.
5.  **Set Context:** It encodes necessary data (like the verified price and the user's address) into the `context` variable, which is passed to the `_postOp` function.

## 3. `paymasterAndData` Structure

The `paymasterAndData` for this contract must be precisely structured and provided by the dApp's frontend after communicating with the off-chain Oracle Signer service.

-   **Bytes 0-51 (52 bytes):** Standard static fields (Paymaster Address + Gas Limits).
-   **Bytes 52-83 (32 bytes):** `offChainPrice` (`uint256`). The ETH vs. Fee Token price, signed by the oracle.
-   **Bytes 84-89 (6 bytes):** `Expiry Timestamp` (`uint48`). A UNIX timestamp after which the signature is no longer valid.
-   **Bytes 90+ (65 bytes):** `Oracle Signature` (`bytes`). An ECDSA signature over the hash of `(userOpHash, offChainPrice, expiry)`.

## 4. Fee Collection (`_postOp`)

After the user's transaction is successfully executed, the `_postOp` hook is called by the `EntryPoint`.
1.  It decodes the `context` to retrieve the verified price and the user's address.
2.  It calculates the `actualFee` based on the `actualGasCost` of the transaction.
3.  It executes **`IERC20(feeToken).transferFrom(user, paymaster, actualFee)`** to collect the payment from the user.

## 5. Admin Functions (`onlyOwner`)

- **`setOracleSigner(address newSigner)`:** Allows the owner to update the address of the trusted off-chain oracle signer.

## 6. Events

- **`FeeCharged(bytes32 indexed userOpHash, address indexed user, uint256 feeAmount)`:** Emitted in `_postOp` after an ERC20 fee is successfully collected from a user.
