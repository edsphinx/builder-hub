# Project Architecture Overview

This document provides a high-level overview of the smart contract architecture for the Builder-Hub project, focusing on the GasX module (ERC-4337 Paymaster and Oracle Aggregation).

## 1. High-Level Overview

The Builder-Hub project aims to provide modular Web3 infrastructure. The core of the current architecture revolves around an ERC-4337 Paymaster (`WalletFuel`) that enables gasless transactions, supported by a robust oracle aggregation system for price feeds.

## 2. Core Components

### 2.1. ERC-4337 Paymaster (`WalletFuel.sol`)
- **Address (Scroll Sepolia):** `0xacd02367eB5A94694b52BF37a8d1641B118cAcEd`
- **Purpose:** The central component for sponsoring user operations. It acts as an ERC-4337 Paymaster, allowing users to pay for gas in alternative tokens (e.g., USDC) or have their gas subsidized entirely.
- **Key Features:**
    - Integrates with a specific `EntryPoint` contract.
    - Manages a deposit to cover gas fees.
    - Implements `validatePaymasterUserOp` to determine if a UserOperation should be sponsored.
    - Uses `WalletFuelConfig` for dynamic parameters (limits, oracle signer).
    - Supports whitelisting of function selectors for sponsored transactions.
    - **Note:** Paymasters are generally designed to be immutable for security and trust reasons, as their logic should not change after deployment.
- **Dependencies:** `IEntryPoint`, `WalletFuelConfig`.

### 2.2. Paymaster Configuration (`WalletFuelConfig.sol`)
- **Address (Scroll Sepolia):** `0x53220F8a08e7008A5c57c40D32200ac3D2B4ee8e`
- **Purpose:** Stores and manages configuration data for the `WalletFuel` Paymaster. This includes the address of the authorized oracle signer and potentially maximum USD subsidy limits per function selector.
- **Key Features:**
    - Stores `oracleSigner` address.
    - Stores `maxUsdPerSelector` mapping.
    - Owner-only functions for updating configuration.
- **Dependencies:** None (acts as a data source).

### 2.3. Multi-Oracle Aggregator (`MultiOracleAggregator.sol`)
- **Implementation Address (Scroll Sepolia):** `0x62B6A3b944077662b84C517007fed1185c66A9d3`
- **Proxy Address (Scroll Sepolia):** `0x954F33832c6C444ab9888aD62DacA25Ad1CBA6cB`
- **Purpose:** Aggregates price feeds from multiple external oracles for a given token pair (e.g., WETH/USDC). It provides robust price data by computing average or median prices and can enforce deviation limits.
- **Key Features:**
    - Supports adding, removing, updating, and toggling individual oracle addresses.
    - Calculates average and median prices from registered oracles.
    - Enforces a maximum deviation between oracle quotes.
    - Upgradeable (UUPS pattern).
- **Dependencies:** External price oracles (e.g., EulerOracleAdapter, DIAOracleAdapter).

### 2.4. Aggregator Factory (`AggregatorFactory.sol`)
- **Address (Scroll Sepolia):** `0x000c18FAcA88BE59025CC8bf8b7100D111545554`
- **Purpose:** A factory contract responsible for deploying and managing instances of `MultiOracleAggregator` for different token pairs. This allows for a standardized and controlled way to create new price aggregators.
- **Key Features:**
    - Deploys `MultiOracleAggregator` proxies.
    - Manages ownership of deployed aggregators.
    - Provides functions to query existing aggregators.
- **Dependencies:** `MultiOracleAggregator` (implementation).

## 3. External Core Dependencies

### 3.1. ERC-4337 EntryPoint
- **Address (Scroll Sepolia v0.8):** `0x4337084d9e255ff0702461cf8895ce9e3b5ff108`
- **Purpose:** The central smart contract for the ERC-4337 Account Abstraction standard. It is responsible for validating, executing, and paying for UserOperations.
- **Interaction:** `WalletFuel` (Paymaster) interacts directly with the `EntryPoint` to sponsor transactions.

## 4. Key Interaction Flows

### 4.1. Sponsored UserOperation Flow
1.  **User creates `UserOperation`:** A user (or their Smart Account) creates a `UserOperation` to perform an action (e.g., call a function on `MockTarget`).
2.  **Bundler receives `UserOperation`:** A Bundler (e.g., Pimlico) receives the `UserOperation` and sends it to the `EntryPoint`.
3.  **`EntryPoint` validates `UserOperation`:** The `EntryPoint` calls `WalletFuel.validatePaymasterUserOp`.
4.  **`WalletFuel` validates & sponsors:**
    *   Checks if the target function selector is whitelisted in `WalletFuel`.
    *   Checks gas limits.
    *   (Future: Verifies oracle signatures via `WalletFuelConfig` and `MultiOracleAggregator` for USD-based sponsorship).
    *   If valid, `WalletFuel` agrees to sponsor the transaction, deducting from its own deposit.
5.  **`EntryPoint` executes `UserOperation`:** The `EntryPoint` executes the user's intended transaction.
6.  **`WalletFuel` `_postOp`:** After execution, `EntryPoint` calls `WalletFuel._postOp` to handle post-transaction logic (e.g., emit `GasSponsored` event for analytics).

## 5. Design Principles

-   **Modularity:** Components are designed to be plug-and-play (e.g., different oracle adapters, separate config contract).
-   **Upgradeability (UUPS):** Key contracts (`WalletFuel`, `MultiOracleAggregator`) are upgradeable to allow for future enhancements and bug fixes without changing contract addresses.
-   **Security:** Emphasis on whitelisting, gas limits, and clear separation of concerns.
-   **Transparency:** Verification on block explorers ensures public auditability.

## 6. Future Considerations

-   Full integration of oracle-based USD limits in `WalletFuel`.
-   More sophisticated oracle adapters and aggregation logic.
-   Integration with ZK identity solutions.
