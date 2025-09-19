# Contract Reference: `MultiOracleAggregator.sol`

This document provides a detailed technical reference for the `MultiOracleAggregator` contract.

- **Source Code:** [`contracts/oracles/MultiOracleAggregator.sol`](../../contracts/oracles/MultiOracleAggregator.sol)
- **Type:** Oracle / Data Feed

## 1. Overview

The `MultiOracleAggregator` is a resilient and secure on-chain price oracle. Its primary purpose is to aggregate price data from multiple independent sources ("adapters") to provide a single, trustworthy price feed for any given token pair.

By fetching data from several oracles and applying statistical validation, it protects the protocol from single points of failure, such as a faulty or manipulated oracle. This contract is a critical dependency for the `GasXERC20FeePaymaster`.



## 2. Core Logic

The aggregator is designed to be highly resilient. For any price request, it performs the following steps:

1.  **Fetch Quotes:** It iterates through all *enabled* oracle adapters registered for a specific token pair (e.g., WETH/USDC).
2.  **Aggregate:** It calculates an aggregate price from all the valid quotes it received. It can be configured to use either the **average** or the **median** value.
3.  **Deviation Check:** As a crucial security measure, it compares each individual oracle's price against the final aggregate price. If any single oracle's quote deviates by more than a configurable threshold (`maxDeviationBps`), the entire transaction reverts. This prevents a single bad actor from poisoning the price feed.

## 3. Key Features

- **Multi-Oracle Support:** Can register and manage an unlimited number of oracle sources per token pair.
- **Statistical Methods:** Provides both `getQuoteAverage` and `getQuoteMedian` functions for flexible price aggregation.
- **Deviation Protection:** The built-in deviation check is a critical security feature against oracle manipulation.
- **UUPS Upgradeable:** The contract is deployed as a UUPS proxy via the `AggregatorFactory`, allowing for its logic to be upgraded in the future without changing its address.
- **Permissioned:** All administrative functions are restricted to the `onlyOwner`.

## 4. Admin Functions (`onlyOwner`)

- **`addOracle(base, quote, oracle)`:** Registers a new oracle adapter for a token pair.
- **`removeOracle(base, quote, index)`:** Removes an oracle from a pair's list.
- **`toggleOracle(base, quote, index, enabled)`:** Enables or disables an oracle without removing it.
- **`setMaxDeviationBps(bps)`:** Sets the maximum allowed deviation in basis points (e.g., `500` for 5%).

## 5. View Functions

- **`computeQuoteAverage(amount, base, quote)`:** Returns the average price for a token pair.
- **`computeQuoteMedian(amount, base, quote)`:** Returns the median price for a token pair.
- **`getOracles(base, quote)`:** Returns the list of all registered oracle adapters for a pair.

## 6. Events

- **`OracleAdded` / `OracleRemoved` / `OracleToggled`:** Emitted when the list of oracles is modified.
- **`QuoteUsed`:** Emitted for every successful quote fetched from an individual oracle, useful for analytics.
- **`QuoteDeviationRejected`:** Emitted when a transaction is reverted due to a high price deviation, which is a critical event to monitor for security.
