# Contract Reference: `GasXERC20FeePaymaster.sol`

This document provides a detailed technical reference for the `GasXERC20FeePaymaster` contract.

- **Source Code:** [`contracts/core/GasXERC20FeePaymaster.sol`](../../packages/hardhat/contracts/core/GasXERC20FeePaymaster.sol)
- **Type:** ERC-4337 Paymaster
- **Inherits:** `BasePaymaster`, `Pausable`

## 1. Overview

The `GasXERC20FeePaymaster` is a smart contract that enables users to pay for their transaction gas fees using a designated ERC20 token (like USDC) instead of the chain's native token (ETH).

The contract sponsors the `UserOperation` by paying the gas in ETH from its own deposit and then, in the `_postOp` hook, collects an equivalent amount of the ERC20 token from the user. This creates a seamless experience for users who primarily hold stablecoins or other tokens.

### Key Security Features
- **Pausable:** Owner can pause/unpause the contract to prevent new sponsorships in emergencies.
- **Immutable Token Configuration:** `feeToken`, `priceQuoteBaseToken`, and `priceOracle` are set at deployment and cannot be changed.
- **Price Deviation Protection:** On-chain price verification with maximum 5% deviation tolerance.
- **Fee Markup Limits:** Maximum 10% markup (1000 basis points) to prevent abuse.
- **Emergency Withdrawal:** Owner can recover ETH accidentally sent to the contract.
- **SafeERC20:** Uses OpenZeppelin's SafeERC20 for secure token operations.

## 2. Core Logic (`_validatePaymasterUserOp`)

The validation logic follows a strict, sequential process to ensure security and prevent abuse. The function uses the `whenNotPaused` modifier from OpenZeppelin's Pausable.

1. **Pause Check:** If the contract is paused, validation reverts with `EnforcedPause()`.
2. **Decode `paymasterAndData`:** The function first decodes the data provided by the user's dApp, which must include a real-time price quote, an expiry timestamp, and a signature from the trusted off-chain Oracle Signer.
3. **Verify Signature & Expiry:** It validates that the signature is from the authorized `oracleSigner` and that the timestamp has not expired.
4. **On-Chain Price Verification:** As a critical security step, it fetches a fresh price from the on-chain `MultiOracleAggregator`. It compares this on-chain price to the signed off-chain price. If the deviation exceeds 5%, it reverts to protect against a compromised signer.
5. **Calculate Required Fee:** Using the verified price, it calculates the required fee with markup.
6. **Check User Allowance & Balance:** It verifies that the user has given the paymaster sufficient ERC20 allowance and has enough balance to cover the required fee.
7. **Set Context:** It encodes necessary data (verified price, user's address, userOpHash) into the `context` variable, which is passed to the `_postOp` function.

## 3. `paymasterAndData` Structure

The `paymasterAndData` for this contract must be precisely structured and provided by the dApp's frontend after communicating with the off-chain Oracle Signer service.

- **Bytes 0-51 (52 bytes):** Standard static fields (Paymaster Address + Gas Limits).
- **Bytes 52-83 (32 bytes):** `offChainPrice` (`uint256`). The ETH vs. Fee Token price, signed by the oracle.
- **Bytes 84-89 (6 bytes):** `Expiry Timestamp` (`uint48`). A UNIX timestamp after which the signature is no longer valid.
- **Bytes 90+ (65 bytes):** `Oracle Signature` (`bytes`). An ECDSA signature over the hash of `(userOpHash, offChainPrice, expiry)`.

## 4. Fee Collection (`_postOp`)

After the user's transaction is successfully executed, the `_postOp` hook is called by the `EntryPoint`.

1. It checks if the operation mode is `opSucceeded`. If not, it returns early.
2. It decodes the `context` to retrieve the verified price, the user's address, and the userOpHash.
3. It calculates the `actualFee` based on the `actualGasCost` using the formula:
   ```
   actualFee = (actualGasCost * onChainPrice * (10000 + feeMarkupBps)) / (1e18 * 10000)
   ```
4. It enforces the minimum fee if `actualFee` is below `minFee`.
5. It executes **`IERC20(feeToken).safeTransferFrom(user, paymaster, actualFee)`** to collect the payment.
6. It updates `totalFeesCollected` for tracking.
7. It emits the `FeeCharged` event.

## 5. Admin Functions (`onlyOwner`)

- **`setOracleSigner(address _newSigner)`:** Updates the address of the trusted off-chain oracle signer. Cannot be zero address. Emits `OracleSignerUpdated`.
- **`setMinFee(uint256 _newMinFee)`:** Updates the minimum fee in fee token units. Emits `MinFeeUpdated`.
- **`setFeeMarkup(uint256 _newMarkupBps)`:** Updates the fee markup (max 1000 = 10%). Emits `FeeMarkupUpdated`.
- **`withdrawFees(address _to, uint256 _amount)`:** Withdraws accumulated ERC20 fees. If `_amount` is 0, withdraws all. Emits `FeesWithdrawn`.
- **`withdrawToken(address _token, address _to, uint256 _amount)`:** Recovers any stuck ERC20 token (except fee token). Emits `TokenRecovered`.
- **`pause()`:** Pauses the paymaster, preventing new sponsorships. Emits `Paused`.
- **`unpause()`:** Unpauses the paymaster, allowing sponsorships again. Emits `Unpaused`.
- **`emergencyWithdrawEth(address payable _to, uint256 _amount)`:** Withdraws ETH accidentally sent to the contract. If `_amount` is 0, withdraws all. Emits `EmergencyWithdraw`.

## 6. View Functions

- **`getFeeBalance()`:** Returns the current fee token balance held by the contract.
- **`estimateFee(uint256 _gasCost)`:** Estimates the fee for a given gas cost using current on-chain price.
- **`checkUserReady(address _user, uint256 _estimatedGasCost)`:** Checks if a user has sufficient allowance and balance. Returns `(hasAllowance, hasBalance, requiredAmount)`.
- **`paused()`:** Returns `true` if the contract is paused.

## 7. Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `OracleSignerUpdated` | `address indexed previousSigner, address indexed newSigner` | Emitted when oracle signer is updated |
| `FeeCharged` | `bytes32 indexed userOpHash, address indexed user, uint256 feeAmount` | Emitted in `_postOp` after fee collection |
| `FeesWithdrawn` | `address indexed to, uint256 amount` | Emitted when fees are withdrawn |
| `MinFeeUpdated` | `uint256 previousMinFee, uint256 newMinFee` | Emitted when minimum fee is changed |
| `FeeMarkupUpdated` | `uint256 previousMarkupBps, uint256 newMarkupBps` | Emitted when markup is changed |
| `TokenRecovered` | `address indexed token, address indexed to, uint256 amount` | Emitted when tokens are recovered |
| `EmergencyWithdraw` | `address indexed to, uint256 amount` | Emitted when ETH is withdrawn via emergency function |
| `Paused` | `address account` | Emitted when contract is paused (from OpenZeppelin) |
| `Unpaused` | `address account` | Emitted when contract is unpaused (from OpenZeppelin) |

## 8. Constants

| Name | Value | Description |
|------|-------|-------------|
| `PAYMASTER_DATA_OFFSET` | 52 | Inherited from BasePaymaster. Standard header size. |
| `PRICE_SIZE` | 32 | Size of price field (uint256 = 32 bytes) |
| `EXPIRY_SIZE` | 6 | Size of expiry timestamp field (uint48 = 6 bytes) |
| `PRICE_DEVIATION_BPS` | 500 | Maximum allowed deviation (5%) between off-chain and on-chain price |

## 9. Security Considerations

1. **Pause Capability:** Use `pause()` immediately if suspicious activity is detected.
2. **Oracle Signer Security:** The `oracleSigner` address must be kept secure. Compromise could allow price manipulation.
3. **Price Deviation:** The 5% maximum deviation protects against oracle manipulation but may reject legitimate transactions during high volatility.
4. **Fee Markup:** Maximum 10% markup prevents excessive fee extraction.
5. **Minimum Fee:** Ensures operational costs are covered even for small transactions.
6. **Immutable Tokens:** `feeToken` and `priceQuoteBaseToken` cannot be changed after deployment.
7. **SafeERC20:** All token transfers use SafeERC20 to handle non-standard ERC20 implementations.
8. **CEI Pattern:** The contract follows Checks-Effects-Interactions pattern in `_postOp`.

## 10. Fee Calculation Formula

The fee is calculated as:
```
fee = (gasCost * price * (10000 + feeMarkupBps)) / (1e18 * 10000)
```

Where:
- `gasCost` is the actual gas cost in wei
- `price` is the on-chain price (how much fee token per 1 ETH)
- `feeMarkupBps` is the markup in basis points (e.g., 100 = 1%)

If the calculated fee is less than `minFee`, the `minFee` is used instead.
