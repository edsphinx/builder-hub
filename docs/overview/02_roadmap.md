# GasX Protocol: Future Features and Architectural Roadmap

## Executive Summary

This document outlines the strategic roadmap for the GasX Protocol, evolving it from its current state as a specialized paymaster into a highly adaptable, multi-strategy gas abstraction layer. The vision is to provide a modular solution for any dApp to sponsor user transactions through a variety of configurable on-chain and off-chain rules. We will explore two primary architectural paths for expansion: a highly flexible on-chain modular system and an industry-standard, off-chain signature-based model.

---

## 1. Vision for the GasX Protocol

The ultimate goal is to evolve GasX into a comprehensive gas abstraction module that any dApp can integrate. Eligibility for gas sponsorship will be determined by a rich set of configurable strategies, including:

- **Asset-Gated Access:** Sponsoring users who hold specific ERC-20 tokens or NFTs.
- **Identity & Reputation:** Leveraging on-chain attestations (e.g., from EAS) to identify eligible users.
- **On-Chain Behavior:** Identifying users based on their historical interactions with specific protocols.
- **Permissioned Lists:** Granular control via whitelists or Merkle trees.

---

## 2. Architectural Paths for Expansion

To achieve the vision, we propose two primary architectural paths.

### 2.1. Path A: On-Chain Modular Eligibility

This path focuses on creating a highly flexible and decentralized system where all eligibility logic is verifiable on-chain.

- **Concept:** Introduce a new, pluggable "module" system where a core `GasXStrategyPaymaster` delegates eligibility checks to specialized, single-purpose contracts.
- **Architectural Components:** This includes a core routing paymaster, a standard `IEligibilityProvider` interface, and specialized modules for checking NFT/Token ownership, Merkle proofs, and on-chain attestations.

### 2.2. Path B: Off-Chain Signature-Based Sponsorship (Industry Standard)

This path aligns GasX with the dominant, highly scalable pattern used by major infrastructure providers.

- **Concept:** Move the complex, dApp-specific eligibility logic off-chain to the dApp's own backend. The paymaster's on-chain role is simplified to only verifying a cryptographic signature from an authorized "oracle signer."
- **Architectural Impact:** This simplifies the on-chain contracts, maximizes flexibility for integrating dApps, and focuses the `GasXConfig` contract on managing trusted signers.

---

## 3. Prioritization & Recommended Strategy

- **Path B (Signature-Based) is the highest priority.** It is the most scalable, secure, and industry-aligned model for a general-purpose paymaster.
- **Path A (On-Chain Modular) is a valuable long-term goal,** ideal for use cases that require maximum decentralization.

**Recommendation:** Focus immediate development on perfecting the signature-based model for the entire GasX Suite.

---
## 4. Development Roadmap

| Quarter | Phase | Key Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Q3 2025** | **Foundation & Core Infrastructure** | - **`GasXWhitelistPaymaster.sol`:** Deployed and verified on Arbitrum & Scroll Sepolia.<br>- **`GasXConfig.sol`:** Centralized configuration deployed.<br>- **`MultiOracleAggregator.sol`:** Multi-oracle price feed with deviation checks.<br>- **Oracle Adapters:** DIA and Euler adapters with factory deployment. | ✅ Complete |
| **Q4 2025** | **USDC & Subscriptions** | - **`GasXERC20FeePaymaster.sol`:** Token fee payments deployed and tested.<br>- **`GasXSubscriptions.sol`:** Tiered subscriptions with credit system.<br>- **Security Audit Preparation:** 97% coverage, 344 unit tests, 101 fuzz tests.<br>- **Static Analysis:** Slither (0 Med/High), Aderyn (0 High). | ✅ Complete |
| **Q1 2026** | **SDK & Partner Onboarding** | - **Developer SDK:** Publish NPM package for dApp integration.<br>- **Admin Dashboard v1:** UI for managing paymaster configurations.<br>- **First Partner Integrations:** Onboard initial dApps. | 📝 Planned |
| **Q2 2026** | **Scalability & New Strategies** | - **`GasXMerkleProofPaymaster`:** On-chain modular eligibility (Path A).<br>- **Off-Chain Oracle Signer Service:** Production backend for signature validation.<br>- **Mainnet Deployment:** Launch on Arbitrum, Base, Scroll mainnets. | 📝 Planned |

---

## 5. Naming Conventions & Best Practices

To maintain clarity and organization, the project adheres to specific conventions.

### 5.1. Script Naming Convention for Bundler Integrations
Scripts specific to a bundler provider will adopt the convention: `scriptName.<bundlerProvider>.ts`. (e.g., `sendUserOp.pimlico.ts`).

---

## 6. On-Chain Optimizations and Best Practices

This section documents key architectural patterns and optimizations that have been implemented in the core smart contracts to enhance efficiency, security, and clarity.

### 6.1. Gas Optimization: "Fail-Fast" Validation Logic

-   **Context:** In paymaster contracts that validate off-chain data (like a signed price or a sponsorship signature), the validation process often involves both cheap logical checks (e.g., checking a timestamp) and expensive cryptographic operations (e.g., `ecrecover`).
-   **Pattern Implemented:** The paymaster logic has been structured to follow the "fail-fast" principle. All low-cost validation checks are performed *before* any high-cost cryptographic functions are executed.
-   **Specific Example (`GasXWhitelistPaymaster`):**
    -   The `require(block.timestamp < expiry)` check for an oracle signature's validity was moved from the `_verifyOracleSig` function to the parent `_validatePaymasterUserOp` function.
-   **Benefit:**
    1.  **Gas Savings:** If a `UserOperation` is submitted with an expired signature, the transaction now reverts immediately on the cheap timestamp check. It avoids executing the `ecrecover` operation, which costs thousands of gas, saving money for the bundler and reducing the load on the network.
    2.  **Code Clarity:** This enforces a clear separation of concerns, where the main validation function (`_validatePaymasterUserOp`) is responsible for all business rules, and helper functions (`_verifyOracleSig`) are responsible for specialized, single tasks.

---

## 7. Known Issues

### 7.1. `permissionless` Library Integration in Hardhat Tests

- **Problem:** Persistent `TypeError: createPimlicoPaymasterClient is not a function` when attempting to run integration tests or standalone scripts using the `permissionless` library (specifically version `0.2.49`) within the Hardhat environment.
- **Symptoms:**
    - `TypeError: (0 , pimlico_1.createPimlicoPaymasterClient) is not a function`
    - `ReferenceError: pimlicoActions is not defined` (when using wildcard imports)
    - `No matching export` errors during `esbuild` compilation.
- **Attempted Solutions (and their outcomes):**
    1. **Correcting import paths:** Tried `permissionless/clients/pimlico` and `permissionless/actions/pimlico`. Neither resolved the issue.
    2. **Fixing `permissionless` version:** Ensured `0.2.49` was explicitly installed. No change.
    3. **Configuring `ts-node` for ESM:** Modified `tsconfig.json` and `package.json` to enable ESM support for `ts-node`. This led to new module resolution errors.
    4. **Using wildcard imports (`import * as ...`):** Attempted to import the entire module. This resulted in `ReferenceError: pimlicoActions is not defined`.
    5. **Creating a standalone ESM package (`paymaster-client`) with `esbuild`:** Even with a dedicated ESM package, `No matching export` errors persisted.
- **Current Understanding:** The problem appears to be a deep incompatibility or a specific packaging issue with `permissionless@0.2.49` when used in a TypeScript/ESM context within a Hardhat/Node.js environment.
- **Recommendation:**
    - Further investigation into the library's internal structure or consulting the `permissionless` community.
    - Consider using a different version of `permissionless` or exploring alternative libraries if this issue remains a blocker for automated E2E testing.

---

## 8. Next Steps

### Completed ✅
- **`GasXERC20FeePaymaster.sol`:** Finalized, tested (100% coverage), and deployed.
- **`GasXSubscriptions.sol`:** Implemented tiered subscription system with credit packs.
- **`GasXWhitelistPaymaster.sol`:** Signature-based pattern with optional selector whitelist.
- **Oracle Infrastructure:** MultiOracleAggregator, DIA & Euler adapters, factory contracts.
- **Security Audit Prep:** 97% line coverage, 344 unit tests, 101 fuzz tests, Slither & Aderyn clean.

### In Progress 🔄
- **Formal Security Audit:** Preparing for external audit engagement.
- **Mainnet Deployment Planning:** Finalizing deployment strategy for Arbitrum, Base, Scroll.

### Upcoming 📝
- **Developer SDK:** NPM package for simplified dApp integration.
- **Admin Dashboard v1:** UI for managing paymaster configurations.
- **Oracle Signer Service:** Production off-chain backend for signature validation.
- **Partner Integrations:** Onboarding first wave of dApp partners.
