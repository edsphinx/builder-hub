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

## 2. Current Architecture Limitations

While the current `GasXWhitelistPaymaster` provides a solid foundation, its design has limitations for achieving the broader vision:

- **Monolithic Validation Logic:** The paymaster's `_validatePaymasterUserOp` function is self-contained and focused on selector whitelisting, lacking the flexibility to query external eligibility criteria.
- **Limited `GasXConfig` Scope:** The config contract is designed for simple, updatable parameters (`oracleSigner`) and would need significant expansion to manage complex rule sets for multiple dApps.
- **Static Whitelisting:** The current `allowedSelectors` mechanism is manual and controlled by a single owner, limiting its adaptability for a multi-dApp ecosystem.

---

## 3. Architectural Paths for Expansion

To achieve the vision, we propose two primary architectural paths.

### 3.1. Path A: On-Chain Modular Eligibility

This path focuses on creating a highly flexible and decentralized system where all eligibility logic is verifiable on-chain.

- **Concept:** Introduce a new, pluggable "module" system where a core `GasXStrategyPaymaster` delegates eligibility checks to specialized, single-purpose contracts.
- **Architectural Components:**
  - **`GasXStrategyPaymaster.sol`:** A new core paymaster that routes validation requests to the appropriate module.
  - **`IEligibilityProvider` Interface:** A standard interface for all eligibility modules.
  - **Eligibility Provider Contracts:**
    - `NFTHolderEligibility.sol`: Checks NFT ownership.
    - `ERC20HolderEligibility.sol`: Checks token balances.
    - `MerkleProofEligibility.sol`: Verifies inclusion in an off-chain list.
    - `AttestationEligibility.sol`: Verifies EAS attestations.
  - **`GasXConfig` Extension:** The config contract would be extended to act as a registry, mapping dApps or functions to their chosen `EligibilityProvider` addresses and rule parameters.

### 3.2. Path B: Off-Chain Signature-Based Sponsorship (Industry Standard)

This path aligns GasX with the dominant, highly scalable pattern used by major infrastructure providers.

- **Concept:** Move the complex, dApp-specific eligibility logic off-chain to the dApp's own backend. The paymaster's on-chain role is simplified to only verifying a cryptographic signature.
- **How it Works:**
  1. A dApp's backend validates a user's action against its own private logic (e.g., premium status, API limits).
  2. If valid, the backend signs the `userOpHash` with its secure private key (the "oracle signer").
  3. The signature is passed to the user's frontend and included in the `paymasterAndData`.
  4. The GasX paymaster's `_validatePaymasterUserOp` recovers the signer from the signature and confirms it's on the authorized list in `GasXConfig`.
- **Architectural Impact:**
  - **Simplifies the Paymaster:** The on-chain contract becomes much simpler, smaller, and easier to audit.
  - **Maximizes Flexibility:** DApps can implement any conceivable eligibility logic in their backend without requiring any on-chain changes from the GasX protocol.
  - **Enhances `GasXConfig`:** The config contract's primary role becomes managing the list of trusted oracle signer addresses for different dApps.

---

## 4. Prioritization & Recommended Strategy

- **Path B (Signature-Based) is the highest priority.** It is the most scalable, secure, and industry-aligned model for a general-purpose paymaster. It simplifies our on-chain footprint and gives integrating dApps maximum flexibility.
- **Path A (On-Chain Modular) is a valuable long-term goal.** It's ideal for use cases that require maximum decentralization and on-chain verifiability, such as DAOs.

**Recommendation:** Focus development on perfecting the signature-based model for the `GasXWhitelistPaymaster` and the upcoming `GasXERC20FeePaymaster`.

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

- **Develop `GasXERC20FeePaymaster.sol`:** Finalize and test the single-token (USDC) paymaster contract based on the off-chain signature pattern.
- **Refactor `GasXWhitelistPaymaster.sol`:** Fully embrace the signature-based pattern, making the on-chain selector whitelist an optional, secondary check.
- **Build the Oracle Signer Service:** Develop the off-chain backend service required for both paymasters to sign validation requests.
- **Update the Admin Dashboard:** Create the UI for managing authorized `oracleSigner` addresses in `GasXConfig`.
