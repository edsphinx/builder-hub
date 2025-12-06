# Project Architecture Overview

This document provides a high-level overview of the smart contract architecture for the Builder-Hub project, focusing on the GasX module (ERC-4337 Paymaster and Oracle Aggregation).

## 1. High-Level Overview

The Builder-Hub project aims to provide modular Web3 infrastructure. The core of the current architecture revolves around an ERC-4337 Paymaster (`GasX`) that enables gasless transactions, supported by a robust oracle aggregation system for price feeds.

## 2. Core Components

### 2.1. ERC-4337 Paymaster (`GasX.sol`)

- **Address (Scroll Sepolia):** `0xacd02367eB5A94694b52BF37a8d1641B118cAcEd`
- **Purpose:** The central component for sponsoring user operations. It acts as an ERC-4337 Paymaster, allowing users to pay for gas in alternative tokens (e.g., USDC) or have their gas subsidized entirely.
- **Key Features:**
  - Integrates with a specific `EntryPoint` contract.
  - Manages a deposit to cover gas fees.
  - Implements `validatePaymasterUserOp` to determine if a UserOperation should be sponsored.
  - Uses `GasXConfig` for dynamic parameters (limits, oracle signer).
  - Supports whitelisting of function selectors for sponsored transactions.
  - **Note:** Paymasters are generally designed to be immutable for security and trust reasons, as their logic should not change after deployment.
- **Dependencies:** `IEntryPoint`, `GasXConfig`.

#### 2.1.1. EntryPoint v0.8.0 Compatibility

A critical aspect of the `GasX` implementation is its compatibility with `EntryPoint v0.8.0`. This version of the `EntryPoint` introduced a more structured `paymasterAndData` field, which required a specific fix in our contract.

- **The Challenge:** `EntryPoint v0.8.0` packs the paymaster's address (20 bytes), `paymasterVerificationGasLimit` (16 bytes), and `paymasterPostOpGasLimit` (16 bytes) into the first 52 bytes of the `paymasterAndData` field. The original `GasX` contract incorrectly interpreted this structure, assuming that any data after the 20-byte address was for oracle-based validation (expiry and signature). This led to an "expired!" revert during local testing.

- **The Solution:** The `GasX.sol` contract was updated to correctly handle the `EntryPoint v0.8.0` data structure. The validation logic now checks if the `paymasterAndData` length exceeds 52 bytes before attempting to decode oracle-specific data. This ensures that the 32 bytes of gas limits are correctly ignored during the validation of non-oracle-based UserOperations, resolving the incompatibility. This fix was validated by the `GasX.e2e.local.test.ts` test suite.

#### 2.1.2. `paymasterAndData` Structure for EntryPoint v0.8.0

Understanding the exact structure of the `paymasterAndData` field is crucial for ERC-4337 compatibility, especially when integrating with `EntryPoint v0.8.0` and bundlers like Pimlico. This field is a `bytes` array that carries information from the Paymaster to the EntryPoint and potentially to the Paymaster itself for validation.

**Official Specification & Community Convention:**

1. **Static Fields (First 52 bytes - defined by EIP-4337 and `UserOperationLib.sol`):**

   - **Bytes 0-19 (20 bytes):** `Paymaster Address` (`address`)
   - **Bytes 20-35 (16 bytes):** `Paymaster Verification Gas Limit` (`uint128`)
   - **Bytes 36-51 (16 bytes):** `Paymaster PostOp Gas Limit` (`uint128`)

   These fields are always expected by the `EntryPoint` if `paymasterAndData` is not empty. Our `GasX.sol` contract was updated to correctly parse these initial 52 bytes.

2. **Custom Paymaster Data (Variable Length - defined by Paymaster implementation):**

   - Following the static fields, Paymasters can include additional custom data. The most common convention for oracle-based sponsorship (as used by bundlers and `permissionless`) is to include an `expiry` timestamp and an `oracleSignature`.
   - **Bytes 52-57 (6 bytes):** `Expiry Timestamp` (`uint48`)
   - **Bytes 58-122 (65 bytes):** `Oracle Signature` (`bytes` for ECDSA signature)

   This means that if a Paymaster uses this convention, the minimum length of `paymasterAndData` would be `52 + 6 + 65 = 123 bytes`.

**References:**

- [EIP-4337: Account Abstraction via EntryPoint Contract](https://eips.ethereum.org/EIPS/eip-4337)
- [`@account-abstraction/contracts/core/UserOperationLib.sol`](https://github.com/eth-infinitism/account-abstraction/blob/main/contracts/core/UserOperationLib.sol) (See `PAYMASTER_DATA_OFFSET` and `unpackPaymasterStaticFields`)
- [`permissionless` Library Documentation](https://permissionless.js.org/) (Refer to `createSmartAccountClient` and `paymaster` options for expected `UserOperation` structure)

- **Address (Scroll Sepolia):** `0x53220F8a08e7008A5c57c40D32200ac3D2B4ee8e`
- **Purpose:** Stores and manages configuration data for the `GasX` Paymaster. This includes the address of the authorized oracle signer and potentially maximum USD subsidy limits per function selector.
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
- **Interaction:** `GasX` (Paymaster) interacts directly with the `EntryPoint` to sponsor transactions.

## 4. Key Interaction Flows

### 4.1. Sponsored UserOperation Flow

1. **User creates `UserOperation`:** A user (or their Smart Account) creates a `UserOperation` to perform an action (e.g., call a function on `MockTarget`).
2. **Bundler receives `UserOperation`:** A Bundler (e.g., Pimlico) receives the `UserOperation` and sends it to the `EntryPoint`.
3. **`EntryPoint` validates `UserOperation`:** The `EntryPoint` calls `GasX.validatePaymasterUserOp`.
4. **`GasX` validates & sponsors:**
   - Checks if the target function selector is whitelisted in `GasX`.
   - Checks gas limits.
   - (Future: Verifies oracle signatures via `GasXConfig` and `MultiOracleAggregator` for USD-based sponsorship).
   - If valid, `GasX` agrees to sponsor the transaction, deducting from its own deposit.
5. **`EntryPoint` executes `UserOperation`:** The `EntryPoint` executes the user's intended transaction.
6. **`GasX` `_postOp`:** After execution, `EntryPoint` calls `GasX._postOp` to handle post-transaction logic (e.g., emit `GasSponsored` event for analytics).

## 5. Design Principles

- **Modularity:** Components are designed to be plug-and-play (e.g., different oracle adapters, separate config contract).
- **Upgradeability (UUPS):** Key contracts (`GasX`, `MultiOracleAggregator`) are upgradeable to allow for future enhancements and bug fixes without changing contract addresses.
- **Security:** Emphasis on whitelisting, gas limits, and clear separation of concerns.
- **Transparency:** Verification on block explorers ensures public auditability.

## 6. Future Considerations

### No-Code Platform Integration
- **Admin Dashboard:** Visual interface for paymaster configuration and monitoring.
- **Campaign Builder:** No-code tool for creating gas sponsorship campaigns with budget limits.
- **Whitelist Manager:** CSV import, API integrations, and visual rule builder.
- **Analytics Dashboard:** Real-time usage metrics, spending reports, and alerts.

### On-Chain Enhancements
- Full integration of oracle-based USD limits in `GasX`.
- More sophisticated oracle adapters and aggregation logic.
- `GasXMerkleProofPaymaster` for on-chain modular eligibility.
