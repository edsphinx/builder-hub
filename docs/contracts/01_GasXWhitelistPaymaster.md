# Contract Reference: `GasXWhitelistPaymaster.sol`

This document provides a detailed technical reference for the `GasXWhitelistPaymaster` contract.

- **Source Code:** [`contracts/core/GasXWhitelistPaymaster.sol`](../../contracts/core/GasXWhitelistPaymaster.sol)
- **Type:** ERC-4337 Paymaster

## 1. Overview

The `GasXWhitelistPaymaster` is a smart contract that provides **full gas sponsorship** for `UserOperations`. Its core security mechanism is a whitelist of approved function selectors. If a `UserOperation` calls a function whose selector is on the whitelist (and meets other criteria), the paymaster will pay 100% of the gas fee on behalf of the user.

## 2. Core Logic (`_validatePaymasterUserOp`)

The validation logic follows a strict, sequential process to ensure security and prevent abuse:

1.  **Selector Whitelist Check:** The first 4 bytes of the `UserOperation.callData` (the function selector) are checked against the `allowedSelectors` mapping. If the selector is not present and set to `true`, the transaction is rejected.
2.  **Gas Ceiling Check:** The `UserOperation.callGasLimit` is checked against the `limits.maxGas` value set by the contract owner. This prevents griefing attacks with excessively high gas limits.
3.  **Optional Oracle Signature Check:** If `paymasterAndData` contains more than the standard 52 bytes, the contract proceeds to validate the appended oracle data.

## 3. `paymasterAndData` Structure

This contract supports two modes of operation based on the `paymasterAndData` field.

### 3.1. Standard Sponsorship (No Oracle)
For a simple whitelist/gas limit check, the `paymasterAndData` field only needs the paymaster's address. The bundler will typically add the required gas limit fields.
- **Length:** 52 bytes
- **Content:**
    - **Bytes 0-19 (20 bytes):** `Paymaster Address`
    - **Bytes 20-51 (32 bytes):** Packed `paymasterVerificationGasLimit` and `paymasterPostOpGasLimit`

### 3.2. Sponsored Operation with Oracle Signature
For dynamic, off-chain validation, additional data must be appended after the standard 52 bytes.

- **Bytes 0-51 (52 bytes):** Standard static fields (Address + Gas Limits).
- **Bytes 52-57 (6 bytes):** `Expiry Timestamp` (`uint48`). A UNIX timestamp after which the signature is no longer valid.
- **Bytes 58+ (65 bytes):** `Oracle Signature` (`bytes`). An ECDSA signature from the authorized `oracleSigner` over the hash of `(userOpHash, expiry)`.

**Example Breakdown:**
A `paymasterAndData` field with an oracle signature will have a minimum length of `52 + 6 + 65 = 123 bytes`. The contract correctly parses this structure.

## 4. Admin Functions (`onlyOwner`)

- **`setLimit(uint256 gas, uint256 usd)`:** Sets the `maxGas` limit for all sponsored transactions.
- **`setSelector(bytes4 sel, bool allowed)`:** Adds or removes a function selector from the whitelist.
- **`setDevMode(bool enabled)`:** Enables or disables developer mode, which bypasses the oracle signature check.

## 5. Events

- **`GasSponsored(address indexed user, uint256 gasUsed, uint256 feeInWei)`:** Emitted in `_postOp` after a transaction is successfully sponsored, providing data for off-chain analytics.
