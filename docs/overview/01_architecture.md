# GasX Protocol: Architecture Overview

This document provides a comprehensive overview of the GasX Protocol's smart contract architecture.

## 1. High-Level Overview

The GasX Protocol is an enterprise-grade, multi-chain infrastructure layer designed to solve the problem of gas fees for dApps through ERC-4337 Account Abstraction.

The protocol is not a single contract but a **suite of specialized paymaster contracts**, supported by a robust on-chain oracle system and a professional development environment. This modular architecture allows dApps to choose the precise gas sponsorship or alternative fee model that best fits their needs, from complete fee subsidization to allowing users to pay with stablecoins.

The entire system is designed with a **chain-agnostic and security-first** mindset.

---
## 2. The GasX Suite of Paymasters

The core of the protocol is a collection of distinct paymaster contracts, each serving a unique purpose.

### 2.1. `GasXWhitelistPaymaster.sol` (Pure Sponsorship)
- **Purpose:** To provide **full gas sponsorship** for specific, pre-approved user actions. The dApp's treasury covers 100% of the gas cost.
- **Use Case:** Frictionless user onboarding (e.g., creating a profile, claiming a starter pack) or promoting key interactions (e.g., a "first free mint" or a "gasless vote").
- **Core Logic:** Validates that the function selector of the `UserOperation` is on a configurable whitelist and that the gas limit is below a set ceiling.

### 2.2. `GasXERC20FeePaymaster.sol` (Alternative Fee Payments)
- **Purpose:** To allow users to **pay for their own gas fees using an ERC20 token** (like USDC) instead of the chain's native token (ETH). The user, not the protocol, ultimately pays for the gas.
- **Use Case:** Enabling a "stablecoin-only" experience for dApps where users may not have or want to acquire native ETH for gas.
- **Core Logic:** Utilizes an off-chain signature for a real-time price quote (ETH vs. the fee token) and an on-chain oracle for security. After sponsoring the transaction in ETH, it collects the equivalent fee in the ERC20 token from the user in the `_postOp` hook.

---
## 3. Core Supporting Infrastructure

These contracts provide essential services to the paymaster suite.

### 3.1. `GasXConfig.sol`
- **Purpose:** Acts as a centralized, on-chain "settings panel" for the GasX protocol.
- **Functionality:** Stores and manages **updatable, operational parameters**, such as the list of authorized off-chain oracle signers. By separating these settings, the core paymaster contracts can remain simple and secure, while operational details can be safely updated by the owner.

### 3.2. `MultiOracleAggregator.sol`
- **Purpose:** To provide a resilient and reliable on-chain price feed.
- **Functionality:** Aggregates price data from multiple independent sources (via "adapters" like the `DIAOracleAdapter`). It can calculate the average or median price and protects against faulty or malicious oracles by enforcing a maximum price deviation. This is critical for the `GasXERC20FeePaymaster` to function securely.

### 3.3. Factories (`AggregatorFactory`, `DIAAdapterFactory`)
- **Purpose:** To deploy and manage instances of the protocol's components in a cheap, efficient, and standardized way.
- **Functionality:** The `AggregatorFactory` uses the UUPS proxy pattern to deploy new `MultiOracleAggregator` instances for different token pairs, while the `DIAAdapterFactory` streamlines the setup of new DIA price feeds.

---
## 4. External Dependencies

### 4.1. `EntryPoint.sol` (ERC-4337)
- **Purpose:** The canonical, singleton smart contract for the ERC-4337 standard. It is responsible for orchestrating the validation and execution of all `UserOperations`.
- **Interaction:** All GasX paymasters are designed to be called by and interact directly with the official `EntryPoint` contract on any given network.

---
## 5. ERC-4337 Implementation Details

### 5.1. EntryPoint v0.8.0 Compatibility
All GasX paymasters are fully compatible with `EntryPoint v0.8.0`. This version introduced a structured `paymasterAndData` field. Our paymaster logic correctly parses the initial 52 bytes (paymaster address + gas limits) defined by the standard before decoding any custom data, ensuring seamless integration.

### 5.2. `paymasterAndData` Structure
The protocol uses the `paymasterAndData` field to pass custom data for validation. Following the 52-byte static fields defined by the standard, our paymasters may expect additional data:
- **For Oracle Signatures:** `expiry (uint48)` and `signature (bytes)`.
- **For ERC20 Fees:** `feeTokenAddress (address)`, `price (uint256)`, `expiry (uint48)`, `signature (bytes)`.

---
## 6. Key Interaction Flows

### 6.1. Whitelist Sponsorship Flow
1.  **User Operation:** A user initiates an action, creating a `UserOperation` to call a whitelisted function.
2.  **Validation:** The `EntryPoint` calls `validatePaymasterUserOp` on the `GasXWhitelistPaymaster`.
3.  **Sponsorship:** The paymaster verifies the function is on its whitelist and agrees to sponsor.
4.  **Execution:** The `EntryPoint` executes the transaction, and the paymaster's stake is used to pay the gas fee in ETH.
5.  **Analytics:** The `EntryPoint` calls `_postOp`, and the paymaster emits a `GasSponsored` event.

### 6.2. ERC20 Fee Payment Flow
1.  **Frontend Request:** The dApp frontend requests a signed price quote from the off-chain **Oracle Signer Service**.
2.  **Off-Chain Signing:** The Oracle Signer returns a signature over the current ETH/USDC price and an expiry timestamp.
3.  **User Operation:** The frontend creates a `UserOperation`, packing the signed price data into the `paymasterAndData` field.
4.  **Validation:** The `EntryPoint` calls `validatePaymasterUserOp` on the `GasXERC20FeePaymaster`.
5.  **Verification:** The paymaster verifies the signature, the expiry, and the price against its on-chain oracle.
6.  **Execution:** The `EntryPoint` executes the transaction, and the paymaster's stake is used to pay the gas fee in ETH.
7.  **Fee Collection:** The `EntryPoint` calls `_postOp`, and the paymaster executes `USDC.transferFrom()` to collect the fee from the user.

---
## 7. Design Principles

- **Security First:** The protocol prioritizes security through modularity, robust validation, and an **"immutable-first" deployment strategy for V1 contracts** to build maximum trust.
- **Modularity:** Each paymaster has a single, well-defined responsibility. This makes the system easier to understand, test, audit, and upgrade.
- **Chain Agnosticism:** Core contracts are not tied to any specific chain. All network-specific configurations are injected at deployment time via a professional suite of Hardhat scripts.
- **Upgradeability:** While V1 contracts are deployed as immutable, the architecture is designed to support future, secure upgradeability for V2+ versions, which will be managed by a **Timelock and Multi-sig** for community trust.

---
## 8. Deployment and Future Vision

For a detailed log of all contract deployments, see the [Deployment History](../deployHistory.md).

For the long-term vision, including new paymaster strategies and advanced features, please refer to the [Future Features and Architectural Roadmap](./02_roadmap.md).
