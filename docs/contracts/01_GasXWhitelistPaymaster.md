# Contract Reference: `GasXWhitelistPaymaster.sol`

This document provides a detailed technical reference for the `GasXWhitelistPaymaster` contract.

- **Source Code:** [`contracts/core/GasXWhitelistPaymaster.sol`](../../packages/hardhat/contracts/core/GasXWhitelistPaymaster.sol)
- **Type:** ERC-4337 Paymaster
- **Inherits:** `BasePaymaster`, `Pausable`

## 1. Overview

The `GasXWhitelistPaymaster` is a smart contract that provides **full gas sponsorship** for `UserOperations`. Its core security mechanism is a whitelist of approved function selectors. If a `UserOperation` calls a function whose selector is on the whitelist (and meets other criteria), the paymaster will pay 100% of the gas fee on behalf of the user.

### Key Security Features
- **Pausable:** Owner can pause/unpause the contract to prevent new sponsorships in emergencies.
- **Immutable Configuration:** `config`, `treasury`, and `environment` are set at deployment and cannot be changed.
- **Dev Mode Disabled by Default:** `isDevMode` defaults to `false` for production safety.
- **Emergency Withdrawal:** Owner can recover ETH accidentally sent to the contract.

## 2. Core Logic (`_validatePaymasterUserOp`)

The validation logic follows a strict, sequential process to ensure security and prevent abuse. The function uses the `whenNotPaused` modifier from OpenZeppelin's Pausable.

1.  **Pause Check:** If the contract is paused, validation reverts with `EnforcedPause()`.
2.  **Selector Whitelist Check:** The first 4 bytes of the `UserOperation.callData` (the function selector) are checked against the `allowedSelectors` mapping. If the selector is not present and set to `true`, the transaction is rejected.
3.  **Gas Ceiling Check:** The `UserOperation.callGasLimit` is checked against the `limits.maxGas` value set by the contract owner. This prevents griefing attacks with excessively high gas limits.
4.  **Optional Oracle Signature Check:** If `paymasterAndData` contains more than the standard 52 bytes, the contract proceeds to validate the appended oracle data.

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

- **`setLimit(uint256 gas, uint256 usd)`:** Sets the `maxGas` limit for all sponsored transactions. Emits `LimitsUpdated`.
- **`setSelector(bytes4 sel, bool allowed)`:** Adds or removes a function selector from the whitelist. Emits `SelectorUpdated`.
- **`setDevMode(bool enabled)`:** Enables or disables developer mode, which bypasses the oracle signature check. Emits `DevModeChanged`.
- **`pause()`:** Pauses the paymaster, preventing new sponsorships. Emits `Paused`.
- **`unpause()`:** Unpauses the paymaster, allowing sponsorships again. Emits `Unpaused`.
- **`emergencyWithdrawEth(address payable to, uint256 amount)`:** Withdraws ETH accidentally sent to the contract. If `amount` is 0, withdraws all balance. Emits `EmergencyWithdraw`.

## 5. View Functions

- **`isDev()`:** Returns `true` if developer mode is enabled.
- **`isProd()`:** Returns `true` if the contract is configured for Production environment.
- **`limits()`:** Returns the current gas and USD limits.
- **`paused()`:** Returns `true` if the contract is paused.

## 6. Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `GasSponsored` | `address indexed sender, uint256 gasUsed, uint256 feeWei` | Emitted in `_postOp` after a transaction is successfully sponsored |
| `LimitsUpdated` | `uint256 maxGas, uint256 maxUsd` | Emitted when gas/USD limits are changed |
| `SelectorUpdated` | `bytes4 indexed selector, bool allowed` | Emitted when a selector is added/removed from whitelist |
| `DevModeChanged` | `bool enabled` | Emitted when developer mode is toggled |
| `EmergencyWithdraw` | `address indexed to, uint256 amount` | Emitted when ETH is withdrawn via emergency function |
| `Paused` | `address account` | Emitted when contract is paused (from OpenZeppelin) |
| `Unpaused` | `address account` | Emitted when contract is unpaused (from OpenZeppelin) |

## 7. Constants

| Name | Value | Description |
|------|-------|-------------|
| `PAYMASTER_DATA_OFFSET` | 52 | Inherited from BasePaymaster. Standard header size. |
| `EXPIRY_SIZE` | 6 | Size of expiry timestamp field (uint48 = 6 bytes) |

## 8. Security Considerations

1. **Dev Mode:** NEVER enable dev mode in production. It bypasses oracle signature validation.
2. **Pause Capability:** Use `pause()` immediately if suspicious activity is detected.
3. **Selector Management:** Only whitelist selectors for functions that should be sponsored.
4. **Gas Limits:** Set appropriate `maxGas` limits to prevent griefing attacks.
5. **Immutable Addresses:** `config`, `treasury`, and `environment` cannot be changed after deployment.
