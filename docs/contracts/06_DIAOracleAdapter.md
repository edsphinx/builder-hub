# Contract Reference: `DIAOracleAdapter.sol`

This document provides a detailed technical reference for the `DIAOracleAdapter` contract.

- **Source Code:** [`contracts/oracles/DIAOracleAdapter.sol`](../../packages/hardhat/contracts/oracles/DIAOracleAdapter.sol)
- **Type:** Oracle Adapter
- **Implements:** `IPriceOracle`

## 1. Overview

The `DIAOracleAdapter` is a smart contract that wraps DIA Oracle V2 price feeds and exposes them through the standard `IPriceOracle` interface. This allows the `MultiOracleAggregator` to consume DIA price data alongside other oracle sources.

### Key Features
- **DIA Integration:** Consumes price feeds from DIA Oracle V2 contracts.
- **Staleness Protection:** Reverts if price data is older than 1 hour.
- **Zero Price Protection:** Reverts if the oracle returns a zero price.
- **Multi-Pair Support:** Can be configured for multiple token pairs via `setPairKey`.

## 2. Core Logic (`getQuote`)

The `getQuote` function converts an input amount of base tokens to quote tokens using DIA price data.

1. **Pair Key Lookup:** Retrieves the DIA key string for the given base/quote pair.
2. **Price Fetch:** Calls `dia.getValue(key)` to get the current price and timestamp.
3. **Zero Price Check:** Reverts with `ZeroPrice()` if price is 0.
4. **Staleness Check:** Reverts with `StalePrice()` if data is older than 1 hour.
5. **Conversion:** Converts input amount using `(price * inAmount) / 1e8`.

### Price Decimals
- DIA prices are returned with **8 decimals**.
- Input amounts are expected in **18 decimals**.
- Output amounts are returned in **18 decimals**.

## 3. Constructor Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `_diaOracle` | `address` | Address of the DIA Oracle V2 contract |
| `_base` | `address` | Initial base token address |
| `_quote` | `address` | Initial quote token address |
| `_key` | `string` | Initial DIA feed key (e.g., "ETH/USD") |

## 4. Admin Functions (`onlyOwner`)

- **`setPairKey(address base, address quote, string key)`:** Sets or updates the DIA key for a token pair. Emits `PairKeySet`.

## 5. View Functions

- **`dia()`:** Returns the immutable DIA oracle contract address.
- **`owner()`:** Returns the immutable owner address.
- **`pairKeys(address base, address quote)`:** Returns the DIA key for a given pair.
- **`getQuote(uint256 inAmount, address base, address quote)`:** Returns the converted amount.

## 6. Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `PairKeySet` | `address indexed base, address indexed quote, string key` | Emitted when a pair key is set or updated |

## 7. Custom Errors

| Error | Description |
|-------|-------------|
| `ZeroAddress()` | Thrown when a zero address is provided |
| `PairNotSet()` | Thrown when querying a pair without a configured key |
| `ZeroPrice()` | Thrown when the oracle returns a zero price |
| `StalePrice()` | Thrown when price data is older than 1 hour |

## 8. Security Considerations

1. **Staleness Window:** The 1-hour staleness check protects against using outdated prices.
2. **Immutable Owner:** The owner cannot be changed after deployment.
3. **Immutable Oracle:** The DIA oracle address is set at deployment and cannot be changed.
4. **Key Validation:** Empty keys will cause `PairNotSet` errors on queries.
