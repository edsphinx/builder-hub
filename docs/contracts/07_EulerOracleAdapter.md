# Contract Reference: `EulerOracleAdapter.sol`

This document provides a detailed technical reference for the `EulerOracleAdapter` contract.

- **Source Code:** [`contracts/oracles/EulerOracleAdapter.sol`](../../packages/hardhat/contracts/oracles/EulerOracleAdapter.sol)
- **Type:** Oracle Adapter
- **Implements:** `IPriceOracle`

## 1. Overview

The `EulerOracleAdapter` is a smart contract that wraps Euler Protocol price oracles and exposes them through the standard `IPriceOracle` interface. This allows the `MultiOracleAggregator` to consume Euler price data alongside other oracle sources.

### Key Features
- **Euler Integration:** Consumes price feeds from Euler on-chain oracles.
- **Fixed Pair:** Each adapter instance serves a single base/quote pair.
- **Safe Math:** Uses OpenZeppelin's `Math.mulDiv` for overflow-safe calculations.
- **Zero Price Protection:** Reverts if the oracle returns a zero price.

## 2. Core Logic (`getQuote`)

The `getQuote` function converts an input amount of base tokens to quote tokens using Euler price data.

1. **Pair Validation:** Verifies that the requested pair matches the configured pair.
2. **Price Fetch:** Calls `euler.getPrice(base, quote)` to get the current price.
3. **Zero Price Check:** Reverts with `ZeroPrice()` if price is 0.
4. **Conversion:** Converts input amount using `Math.mulDiv(inAmount, price, 1e18)`.

### Price Decimals
- Euler prices are returned with **18 decimals** precision.
- Input amounts are expected in **18 decimals**.
- Output amounts are returned in **18 decimals**.

## 3. Constructor Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `_euler` | `address` | Address of the Euler oracle contract |
| `_base` | `address` | Base token address for this adapter |
| `_quote` | `address` | Quote token address for this adapter |

### Constructor Validations
- Reverts with `ZeroAddress()` if any address is zero.
- Reverts with `NotContract()` if `_euler` has no code (not a contract).

## 4. View Functions

- **`euler()`:** Returns the immutable Euler oracle contract address.
- **`base()`:** Returns the immutable base token address.
- **`quote()`:** Returns the immutable quote token address.
- **`getQuote(uint256 inAmount, address base, address quote)`:** Returns the converted amount.

## 5. Custom Errors

| Error | Description |
|-------|-------------|
| `ZeroAddress()` | Thrown when a zero address is provided |
| `NotContract()` | Thrown when the Euler address has no code |
| `InvalidPair()` | Thrown when querying a pair that doesn't match the configured pair |
| `ZeroPrice()` | Thrown when the oracle returns a zero price |

## 6. Security Considerations

1. **Immutable Configuration:** All addresses (euler, base, quote) are set at deployment and cannot be changed.
2. **Contract Validation:** The constructor verifies that the Euler address contains code.
3. **Overflow Protection:** Uses `Math.mulDiv` for safe multiplication and division.
4. **Single Pair:** Each adapter instance only serves one token pair, preventing configuration errors.

## 7. Differences from DIAOracleAdapter

| Feature | DIAOracleAdapter | EulerOracleAdapter |
|---------|------------------|-------------------|
| **Pair Configuration** | Dynamic (via `setPairKey`) | Fixed at deployment |
| **Staleness Check** | Yes (1 hour) | No (relies on Euler) |
| **Price Decimals** | 8 decimals | 18 decimals |
| **Owner Functions** | Yes (`setPairKey`) | None |
