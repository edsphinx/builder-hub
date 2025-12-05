# Builder-Hub: The GasX Suite of Paymasters

![Builder-Hub Logo](https://github.com/edsphinx/builder-hub/blob/main/.github/assets/gasx.png)

**GasX is a professional suite of ERC-4337 Paymasters designed to eliminate gas fee friction for any dApp.**
_Sponsor transactions completely with our **Whitelist Paymaster**, or empower users to pay gas with tokens like **USDC** using our **ERC20 Fee Paymaster**. GasX is the flagship protocol of Builder-Hub._

[![CI](https://github.com/edsphinx/builder-hub/workflows/CI/badge.svg)](https://github.com/edsphinx/builder-hub/actions)
[![Telegram](https://img.shields.io/badge/chat-Telegram-blue?logo=telegram)](https://t.me/edsphinx)
[![MIT License](https://img.shields.io/badge/License-MIT-success)](LICENSE)

---

## ✨ Why GasX Matters

On-chain adoption stalls when new users must first acquire a native gas token (like ETH) before they can perform any action. The **GasX Suite** directly solves this by offering two powerful solutions that dApps can integrate:

1.  **Complete Sponsorship (`GasXWhitelistPaymaster`):**
    -   **Problem:** You want to offer a truly free "first mint" or "create profile" experience to onboard new users.
    -   **Solution:** The protocol uses the `GasXWhitelistPaymaster` to pay 100% of the gas fees for specific, pre-approved actions, creating a frictionless, Web2-like experience.

2.  **Convenient Payments (`GasXERC20FeePaymaster`):**
    -   **Problem:** Your users hold stablecoins like USDC but don't have ETH on the right network to pay for gas.
    -   **Solution:** The `GasXERC20FeePaymaster` allows users to pay for their own transactions using USDC. The protocol handles the on-chain price conversion and pays the network in ETH, abstracting away the native gas token entirely.

The GasX Suite is currently deployed and tested on **Arbitrum Sepolia** and **Scroll Sepolia** and is fully compatible with EntryPoint v0.8.

---
## 📈 Project Status & Milestones

The GasX Protocol has achieved a **feature-complete MVP (Minimum Viable Product)** state. The core contracts, tooling, and documentation have been professionally architected, providing a stable foundation for rigorous testnet validation and future expansion.

| Category | Deliverable | Status |
| :--- | :--- | :---: |
| **Smart Contracts** | **`GasXWhitelistPaymaster`** deployed and verified on-chain. | ✅ |
| | **`GasXConfig`** and **`MultiOracleAggregator`** deployed and verified. | ✅ |
| | **`GasXERC20FeePaymaster`** deployed and verified. | ✅ |
| | **`GasXSubscriptions`** subscription & credit payment system. | ✅ |
| **Tooling** | Professional, multi-chain Hardhat deployment and testing suite. | ✅ |
| **Frontend** | Functional Next.js demo app for gasless transactions. | ✅ |
| **Testing** | Unit, Integration, E2E, Fuzz, and Invariant tests with 100% coverage on core. | ✅ |
| **Security** | Pausable contracts, emergency withdrawals, events for monitoring. | ✅ |
| **Documentation** | Complete `/docs` suite, including architecture, guides, and references. | ✅ |
| **Open Source** | MIT License, `CONTRIBUTING.md`, and `SECURITY.md` in place. | ✅ |

The project is fully prepared for deployment and E2E testing on the **Arbitrum** network.

---

## ✅ Comprehensive Test Coverage

The GasX Protocol is rigorously tested using a multi-layered approach to ensure reliability and security. Our test suite includes unit tests, integration tests, fuzz tests, and invariant tests.

| Test Type | Contract / System Tested | Key Verifications |
| :--- | :--- | :--- |
| **Unit & Integration** | `GasXWhitelistPaymaster` | Owner-only access, selector whitelisting, gas limit enforcement, oracle signature logic, pausable, emergency withdrawal. |
| | `GasXERC20FeePaymaster` | Token fee payments, price oracle integration, pausable functionality. |
| | `GasXSubscriptions` | Plan management, credit system, ETH/token payments, CEI pattern. |
| | `GasXConfig` | Correct deployment, access control, and parameter updates. |
| | `MultiOracleAggregator`| Oracle management, average/median price calculation, and deviation checks. |
| **Fuzz Testing** | `GasXWhitelistPaymaster` | 9 fuzz tests with 1,000 runs each. |
| | `GasXSubscriptions` | 9 fuzz tests with 1,000 runs each. |
| **Invariant Testing** | `GasXWhitelistPaymaster` | 9 invariant properties verified via Echidna. |
| | `GasXSubscriptions` | 7 invariant properties verified via Echidna. |
| **End-to-End (E2E)** | Full AA Stack (Local) | Simulates a complete, sponsored `UserOperation` on a local Hardhat network. |
| | Full AA Stack (Public) | Verifies the entire flow on live testnets (e.g., Arbitrum Sepolia) using a real bundler. |

### Coverage Summary

| Contract | Statements | Branches | Functions | Lines |
|----------|------------|----------|-----------|-------|
| `GasXWhitelistPaymaster` | 100% | 88.1% | 100% | 100% |
| `GasXERC20FeePaymaster` | 100% | 96.88% | 100% | 100% |
| `GasXSubscriptions` | 93.18% | 68.82% | 88.57% | 95.57% |
| `GasXConfig` | 100% | 91.67% | 100% | 100% |

> The entire test suite is run automatically on every commit via our **Continuous Integration** pipeline.

---

## 🛠️ Architectural & Security Highlights

-   **Security-First Design:** V1 contracts are deployed as **immutable** for maximum trust. The protocol uses a strict separation of concerns and includes on-chain protections like gas ceilings and selector whitelists.
-   **Pausable Contracts:** All paymasters can be paused by the owner in case of emergency, using OpenZeppelin's `Pausable` with `whenNotPaused` modifier.
-   **Emergency Recovery:** `emergencyWithdrawEth()` allows recovery of accidentally sent ETH.
-   **Comprehensive Events:** All admin actions emit events for monitoring: `LimitsUpdated`, `SelectorUpdated`, `DevModeChanged`, `Paused`, `Unpaused`, `EmergencyWithdraw`.
-   **Multi-Paymaster Suite:** A suite of specialized paymasters allows dApps to choose the exact tool for their needs.
-   **Resilient On-Chain Oracles:** A robust `MultiOracleAggregator` provides reliable price data with built-in deviation checks.
-   **Chain-Agnostic Architecture:** Professional deployment scripts and a centralized configuration allow for seamless multi-chain support.
-   **Off-Chain Extensibility:** Paymasters support time-bound signatures from off-chain services for powerful, real-time validation logic.
-   **Analytics & Monitoring:** Paymasters emit detailed events like `GasSponsored` on every successful transaction.

---

## 🚀 Roadmap

| Quarter | Phase | Key Deliverables |
| :--- | :--- | :--- |
| **Q3 2025** | **Foundation & Launch** | - **`GasXWhitelistPaymaster`:** Deploy the immutable contract on Arbitrum & other L2s.<br>- **Professional Tooling:** Finalize the multi-chain deployment and testing suite.<br>- **Complete Documentation:** Publish the full `/docs` suite. |
| **Q4 2025**| **USDC & Partner Onboarding**| - **`GasXERC20FeePaymaster`:** Develop, test, and deploy the USDC fee paymaster.<br>- **Off-Chain Service:** Launch the secure Oracle Signer service.<br>- **First Partner Integrations:** Onboard the first wave of dApps. |
| **Q1 2026**| **SDK & Scalability** | - **Developer SDK:** Release a public NPM package to simplify dApp integration.<br>- **Admin Dashboard v1:** Launch a UI for partners to manage paymaster configurations. |

---
## 📘 Documentation

Comprehensive technical documentation for the GasX protocol is maintained in the `/docs` directory. The best place to start is the **[Documentation Hub (`/docs/index.md`)](./docs/index.md)**.

-   **[Architecture Overview](./docs/overview/01_architecture.md):** A deep dive into the smart contract system.
-   **[Deployment Guide](./DEPLOYMENT_GUIDE.md):** Step-by-step instructions for deploying the protocol.

---
## 🔨 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js:** `20.19.3` (Exact version recommended)
- **Yarn:** v3.x or higher

### 2. Setup & Run
```bash
# Clone the repo and install dependencies
git clone [https://github.com/edsphinx/builder-hub.git](https://github.com/edsphinx/builder-hub.git)
cd builder-hub
yarn install

# In one terminal, run the local blockchain & deploy contracts
cd packages/hardhat
yarn deploy

# In a second terminal, start the frontend demo
cd packages/nextjs
yarn start
```
> The frontend is now available at `http://localhost:3000`.

---
## 🤝 Contributing & Security

The GasX Protocol is an open-source project. We welcome contributions and take security very seriously. Please see our **[Contributing Guide](./CONTRIBUTING.md)** and our **[Security Policy](./SECURITY.md)**.

## 👥 Core Team

| Name | Role | GitHub / X |
| :--- | :--- | :--- |
| **edsphinx** | Lead Solidity / ZK | [@edsphinx](https://github.com/edsphinx) / [@oFonCK](https://x.com/oFonCK) |

---
## ✍️ Licence

MIT – see [LICENSE](LICENSE).

---
_Made with ♥ in Honduras. Coming soon to Arbitrum, Base, Scroll, and more._
