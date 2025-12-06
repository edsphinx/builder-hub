# GasX Protocol: Future Features and Architectural Roadmap

## Executive Summary

This document outlines the strategic roadmap for the GasX Protocol, evolving it from its current state as a specialized paymaster into a **No-Code Gas Sponsorship Platform**. Unlike enterprise SDK solutions (Pimlico, Alchemy, Biconomy), GasX focuses on enabling **any project to implement gas sponsorship without developer resources**.

---

## 1. Vision for the GasX Protocol

The ultimate goal is to evolve GasX into a **No-Code/Low-Code platform** where non-technical teams can:

- **Configure gas sponsorship visually** through an Admin Dashboard
- **Create campaigns** with budget limits, time windows, and eligibility rules
- **Import whitelists** via CSV, API connections, or visual rule builders
- **Monitor spending and usage** with real-time analytics
- **Integrate instantly** with copy-paste embed widgets

### Target Users

| User Type | Need | GasX Solution |
|:---|:---|:---|
| **Marketing Teams** | Sponsor gas for promotional campaigns | Campaign Builder with budget caps |
| **Community Managers** | Reward active community members | Whitelist Manager with CSV import |
| **Product Managers** | Reduce friction for new users | Embed Widget for instant integration |
| **Founders** | Launch without hiring Web3 devs | No-Code Dashboard for full control |

---

## 2. Competitive Differentiation

### Why Not Use Existing Solutions?

| Feature | Pimlico/Alchemy/Biconomy | GasX |
|:---|:---|:---|
| **Target User** | Developers | Non-technical teams |
| **Integration** | SDK/API coding required | No-code dashboard |
| **Campaign Management** | Build your own | Built-in campaign builder |
| **Whitelist Management** | Manual API calls | CSV import, visual rules |
| **Analytics** | Build your own | Built-in dashboard |
| **Time to Launch** | Days/weeks of development | Minutes |

### GasX Unique Value

- **No-Code First:** Every feature designed for non-developers
- **Campaign-Centric:** Built around marketing/growth use cases
- **Self-Service:** No sales calls, no enterprise contracts
- **Transparent Pricing:** Pay-as-you-go with credit system

---

## 3. Platform Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GasX No-Code Platform                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Admin Dashboard │  │ Campaign Builder│  │    Analytics    │  │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤  │
│  │ - Paymaster     │  │ - Budget Limits │  │ - Usage Metrics │  │
│  │   Configuration │  │ - Time Windows  │  │ - Cost Reports  │  │
│  │ - Whitelist     │  │ - Eligibility   │  │ - User Insights │  │
│  │   Management    │  │   Rules         │  │ - Alerts        │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │              Embed Widget / Webhook Integration           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
├──────────────────────────────┼───────────────────────────────────┤
│                     Smart Contracts (On-Chain)                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Paymasters    │  │    Oracles      │  │  Subscriptions  │  │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤  │
│  │ GasXWhitelist   │  │ MultiOracle     │  │ GasXSubscript.  │  │
│  │ GasXERC20Fee    │  │ DIAAdapter      │  │ Credit System   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---
## 4. Development Roadmap

| Quarter | Phase | Key Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Q3 2025** | **Foundation & Core Infrastructure** | - **`GasXWhitelistPaymaster.sol`:** Deployed and verified on Arbitrum & Scroll Sepolia.<br>- **`GasXConfig.sol`:** Centralized configuration deployed.<br>- **`MultiOracleAggregator.sol`:** Multi-oracle price feed with deviation checks.<br>- **Oracle Adapters:** DIA and Euler adapters with factory deployment. | ✅ Complete |
| **Q4 2025** | **USDC & Subscriptions** | - **`GasXERC20FeePaymaster.sol`:** Token fee payments deployed and tested.<br>- **`GasXSubscriptions.sol`:** Tiered subscriptions with credit system.<br>- **Security Audit Preparation:** 97% coverage, 344 unit tests, 101 fuzz tests.<br>- **Static Analysis:** Slither (0 Med/High), Aderyn (0 High). | ✅ Complete |
| **Q1 2026** | **No-Code Platform v1** | - **Admin Dashboard:** Visual paymaster configuration & real-time monitoring.<br>- **Campaign Builder:** Create sponsorship campaigns with budget limits & time windows.<br>- **Whitelist Manager:** CSV import, API connections, visual rule builder. | 📝 Planned |
| **Q2 2026** | **Platform Expansion** | - **Analytics Dashboard:** Usage metrics, spending reports, user insights, alerts.<br>- **Embed Widget:** Copy-paste integration snippet for any website.<br>- **Webhook/Zapier Integration:** Connect with existing tools and workflows.<br>- **Mainnet Deployment:** Launch on Arbitrum, Base, Scroll mainnets. | 📝 Planned |

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

### Upcoming - No-Code Platform 📝

| Feature | Description | Priority |
|:---|:---|:---:|
| **Admin Dashboard** | Visual paymaster configuration, real-time monitoring | P0 |
| **Campaign Builder** | Budget limits, time windows, eligibility rules | P0 |
| **Whitelist Manager** | CSV import, API integrations, visual rule builder | P0 |
| **Analytics Dashboard** | Usage metrics, spending reports, user insights | P1 |
| **Embed Widget** | Copy-paste integration snippet for any website | P1 |
| **Webhook/Zapier** | Connect with existing tools and workflows | P2 |
| **Multi-tenant Support** | Multiple projects per account | P2 |
