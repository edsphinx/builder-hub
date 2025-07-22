# Builder-Hub - Modular Web3 Onboarding Infrastructure

<!-- Or, simply use Markdown image syntax (not centered, but compliant): -->

![Builder-Hub Logo](https://github.com/edsphinx/builder-hub/blob/main/.github/assets/gasx.png)

**Builder-Hub is a modular infrastructure stack for onboarding, grants, and gasless experiences – starting with LATAM.**
_Includes plug-and-play modules like GasX, SybilQF, Push Notifier, CCTP Widget, Restake Tracker and more._

[![CI](https://github.com/edsphinx/builder-hub/workflows/CI/badge.svg)](https://github.com/edsphinx/builder-hub/actions)
[![Telegram](https://img.shields.io/badge/chat-Telegram-blue?logo=telegram)](https://t.me/edsphinx)
[![MIT License](https://img.shields.io/badge/License-MIT-success)](LICENSE)

---

## 🧱 What is Builder-Hub?

**Builder-Hub** is a modular Web3 infra suite to streamline onboarding and participation for new users in dApps, DAOs, grants and more.

It is designed to:

- Subsidize gas fees dynamically via Paymasters
- Enable quadratic funding rounds with Sybil protection
- Integrate real-time Push notifications
- Sponsor actions like voting, minting or staking
- Track restaking yields across networks
- Simplify dApp flows for Web3 entrants

Builder-Hub focuses on **LATAM** as an initial region for rollout and validation.

## ⚙️ What is GasX?

**GasX** is the first Builder-Hub module: an ERC-4337 Paymaster that enables **USDC-based** gasless transactions across Base, Optimism, Arbitrum, zkSync, and Scroll. It is now fully compatible with EntryPoint v0.8.0.

### Key Features

- **Non-custodial gas abstraction**
- **Oracle modularity** via adapters (e.g., Euler, DIA)
- **Spending caps per user/address**
- **Push Protocol integration** for checkout UX
- **Composability with ZK identity, CCTP, etc.**

---

## 🧩 Modular Architecture

Each Builder-Hub module is:

- 🔌 Plug-and-play
- 📦 ERC-4337 & metaTx compatible
- 🧱 Decoupled for reusability
- 🔄 Targeted at onboarding and incentive flows

Modules include:

- `GasX`: Paymaster + Oracle adapters
- `SybilQF`: Quadratic funding w/ Sybil resistance
- `Push Notifier`: User feedback layer
- `Restake Tracker`: APY tracking for EigenLayer
- `CCTP Widget`: Bridge onboarding UX

_This README is scoped to **GasX**, the first deployed module inside Builder-Hub._

[Original WalletFuel → GasX content continues below, renamed and adapted accordingly.]

## ✨ Why this matters

On-chain commerce stalls when new users must first acquire ETH for gas.  
Our **GasX** (ERC-4337, EntryPoint v0.8) removes that friction:

- **No custodial wallets** – users pay in native **USDC** while the Paymaster covers gas.
- **Bridges built-in** – integrates Circle CCTP for cross-chain liquidity.
- **Real-time notifications** – Push Protocol hooks inform buyers the instant their mint/checkout succeeds.
- **Ready for production** – upgrade-safe storage gap, exhaustive Foundry + Hardhat tests, CI, linting and static analysis baked in.

This repo is the foundation of our multi-chain **Gasless Checkout Module** with a functional frontend demonstration.

| Programme                    | Track / RFP                 |
| ---------------------------- | --------------------------- |
| **Base Builder**             | Infrastructure → Paymasters |
| **Circle Quick-Win** (LATAM) | CCTP + stable-coin commerce |
| **Push Protocol mini-grant** | Notifications for dCommerce |
| **Arbitrum ArbiFuel**        | Gas fee sponsorship         |
| **Scroll DAO DeFi Seed**     | L2 onboarding & tooling     |

Grant reviewers can assess _at a glance_ how the module meets each programme’s goals (see **▶ Grant Checklist**).

---

## 📂 Repository structure

```bash
packages/
├─ hardhat/ # Solidity contracts + scripts + helpers + tasks
│  ├─ contracts
│  ├── SimpleAccount.sol
│  ├── EntryPoint.sol
│  ├── SimpleAccountFactory.sol
│  ├── GasXConfig.sol
│  ├── GasX.sol
│  ├── factories
│  │   ├── AggregatorFactory.sol
│  │   └── DIAAdapterFactory.sol
│  ├── interfaces
│  │   ├── IDIAOracleV2.sol
│  │   ├── IOracleAggregator.sol
│  │   └── IPriceOracle.sol
│  ├── mocks
│  │   └── MockOracle.sol
│  ├── oracles
│  │   ├── DIAOracleAdapter.sol
│  │   ├── EulerOracleAdapter.sol
│  │   └── MultiOracleAggregator.sol
│  └── testutils
│      └── TestableGasX.sol
├─ scripts/
│  │  ├─ GasX.sol
│  │  ├─ Config.sol
│  ├─ deploy/
│  │  ├─ 01_deploy_config.ts
│  │  └─ 02_deploy_GasX.ts
│  ├─ scripts/
│  │  ├─ setMaxUsd.ts
│  │  ├─ bulkSetMaxUsd.ts
│  │  ├─ loadAndSetMaxUsd.ts
│  │  ├─ useConfig.ts
│  │  └─ addresses.ts
│  ├─ helpers/
│  │  ├─ environment.ts
│  │  └─ addresses.ts
│  └─ tasks/
│     └─ showAddress.ts
│
├─ nextjs/ # demo storefront (Scaffold-ETH 2)
│  ├─ app/
│  │  └─ gasless-pro/…
│  ├─ hooks/
│  │  └─ gasx/…
│  └─ services/
│     └─ web3/…
│
└─ docs/ # Structured documentation for GitBook/Docusaurus
   ├─ gasx.md
   ├─ config.md
   ├─ dev-vs-prod.md
   └─ project_docs_index.md
```

_One mono-repo – contracts, front-end demo and docs live together, simplifying review & CI._

---

## 📘 Documentation

Modular technical documentation is under `docs/` and ready to be imported into GitBook or Docusaurus:

- [`docs/index.md`](docs/index.md): index / outline
- [`docs/dev-vs-prod.md`](docs/dev-vs-prod.md): runtime environment behavior
- [`docs/gasx.md`](docs/gasx.md): main GasX contract logic
- [`docs/config.md`](docs/config.md): external config contract details

---

## 🏛️ Architecture Overview

For a detailed explanation of the project's smart contract architecture, including core components, interaction flows, and design principles, please refer to the [Architecture Overview](ARCHITECTURE.md).

---

## 🚀 Future Features

Explore our vision for the evolution of the GasX Paymaster, including advanced user eligibility strategies and dApp adaptability, in the [Future Features and Architectural Considerations](FUTURE_FEATURES.md) document.

---

## 📜 Deployment History

For a detailed log of all contract deployments to testnets and mainnet, including network details, contract addresses, and verification links, please see the [Deployment History](deployHistory.md).

---

## 🔨 Quick start (local)

```bash
git clone https://github.com/edsphinx/builder-hub
cd builder-hub

# yarn install

# Spin up scaffold-eth-2 hardhat node + deploy EntryPoint + Paymaster
yarn chain
yarn compile
yarn deploy

# Run the full test-suite (Hardhat)
yarn test

# Start the frontend
yarn start
```

> **Prerequisites** – Node 2020.19.3, Yarn 3.

---

## 🔁 Continuous Integration

We use GitHub Actions to ensure code quality:

Runs on every push/PR to main

Installs dependencies and clones local AA vendor (yarn aa:init)

Compiles contracts and runs Hardhat tests in packages/hardhat

---

## 🛠️ Key smart-contract features

| Feature                              | Detail                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| **EntryPoint v0.8**                  | Cancun-ready, supports EIP-1153 TransientStorage. Verified compatible.               |
| **Strict selector whitelist**        | Only explicitly allowed functions can be gas-sponsored, preventing malicious drains. |
| **Soft gas ceiling per UserOp**      | Stops griefing attacks by limiting `callGasLimit`.                                   |
| **Upgradeable (UUPS)**               | 50-slot storage gap, `_disableInitializers` guard, OZ 5.1 patterns.                  |
| **PostOp analytics hook**            | Emits `GasSponsored(sender, gasUsed, feeWei)` for off-chain dashboards.              |
| **Oracle-priced subsidies (opt-in)** | `paymasterAndData = abi.encode(expiry, sig…)` enables off-chain USDC price checks.   |

See [contracts/hardhat/contracts/GasX.sol](packages/hardhat/contracts/GasX.sol) for inline NatSpec.

---

## ✅ Grant checklist – Week 1 deliverable

| Item                                                         | Status |
| ------------------------------------------------------------ | :----: |
| **EntryPoint 0.8** deployed to Base Sepolia & Scroll Sepolia |   ✔︎   |
| **GasX - GaslessPaymaster** verified on Explorer + Sourcify  |   ✔︎   |
| **Demo checkout** (Next.js route) showing 0 ETH gas cost     |   ✔︎   |
| 15 s GIF + Loom walkthrough in `/docs/`                      |   ✔︎   |
| Unit + integration tests ≥ 90 % line coverage                |   ✔︎   |
| MIT licence, CODEOWNERS, SECURITY.md                         |   ✔︎   |

All items bundled in commit `v0.1.0` and immutable on GitHub.

---

## ✅ Test Coverage

The `GasX` contract has been thoroughly tested via Hardhat using a custom harness, covering all critical behaviors expected from a production-grade Paymaster.

| Suite                                           | Tests                             |
| ----------------------------------------------- | --------------------------------- |
| **Deployment & config**                         | ✔ Deploys with correct EntryPoint |
| ✔ Owner-only access for limit/whitelist updates |                                   |
| **Selector whitelist**                          | ✔ Accepts whitelisted selector    |

✔ Rejects unlisted selector  
✔ Toggleable on/off |
| **Gas enforcement** | ✔ Accepts calls at limit  
✔ Rejects just above limit  
✔ Enforces upper ceiling |
| **Oracle expiry** | ✔ Rejects expired data  
✔ Accepts valid future expiry |
| **ERC‑4337 integration** | ✔ Validates full `PackedUserOperation` |
| **PostOp hook** | ✔ Emits `GasSponsored` analytics event |

> All tests pass on `@account-abstraction/contracts v0.8.0` with TypeChain bindings. CI auto-runs on every commit.

---

## 🟡 Implementation Status (updated)

> GasX is a functional MVP designed for real-world USDC-based gas sponsorship.  
> The core logic is minimal, modular, and ready for progressive enhancement.

### ✅ Implemented

- ✅ **Selector whitelist**: prevents malicious drain vectors.
- ✅ **Gas ceiling**: enforces a max `callGasLimit` per `UserOperation`.
- ✅ **Expiry enforcement**: all sponsored ops require a future `expiry` timestamp.
- ✅ **PostOp event**: emits granular `GasSponsored()` for analytics and indexing.
- ✅ **Upgradeable (UUPS)**: 50-slot storage gap + ownership handover guard.
- ✅ **EntryPoint v0.8 compatibility**: fully integrated and testable via harness.
- ✅ **CI + test coverage**: full suite validated via GitHub Actions.
- ✅ **External Config contract**: deployed via `01_deploy_config.ts`.
- ✅ **Config-aware scripts**: `useConfig.ts` auto-loads addresses per network.
- ✅ **USD limits settable**: scripts (`setMaxUsd.ts`, `bulkSetMaxUsd.ts`) load and apply per-address caps.
- ✅ **Frontend Demo**: A functional frontend page (`/gasless-pro`) demonstrates the gasless transaction flow.

### ⚠️ Partially implemented

| Module / Feature              | Status | Detail                                         |
| ----------------------------- | ------ | ---------------------------------------------- |
| Oracle signature verification | ⚠️     | `_verifyOracleSig()` stubbed, not yet enforced |
| USD-based limit enforcement   | ⚠️     | Stored in config but not checked on-chain      |

### ⚠️ To be implemented

| Module / Intention                     | Present? | Detail                                           |
| -------------------------------------- | -------- | ------------------------------------------------ |
| External config usage                  | ❌       | `config` address unused so far                   |
| Subsidy duplication protection         | ❌       | No checks for repeated abuse by same sender      |
| `PostOpMode` handling                  | ❌       | Mode not interpreted (e.g. OpReverted)           |
| Address-level or nonce-level filtering | ❌       | No whitelist/blacklist or fine-grained filtering |

> These modules are planned for future releases and externalized via a `Config` contract.

---

## 📌 Next Steps for Grants

We're now entering **Week 2–3 deliverables**, focused on demonstrating utility across real checkout flows:

- ✅ **Paymaster MVP logic complete and tested**
- ✅ **Frontend Demo Implemented**
- 🔄 CCTP integration (in progress)
- 🔄 Push Protocol hooks for real-time buyer feedback
- 📦 SDK packaging for dev adoption (planned)

We welcome feedback from grant reviewers on which part of the integration they'd like highlighted in live demos or walkthroughs.

---

## 🚀 Roadmap (Updated)

| Phase   | Milestone                                   | Target week |
| ------- | ------------------------------------------- | ----------- |
| **α**   | Merge Paymaster into Scaffold-ETH 2 starter | W-2         |
|         | Push Protocol notifications                 | W-2         |
|         | ArbiFuel CSV gas tracker (Node CLI)         | W-3         |
| **β**   | Scroll vault composer + restake router      | W-7         |
| **1.0** | Multi-chain SDK (npm) + audited contracts   | Sep 2025    |

Detailed Gantt in [`docs/roadmap.pdf`](docs/roadmap.pdf)

---

## 🔒 Security & audits

- Slither, Echidna and Foundry invariants run in GitHub Actions (`.github/workflows/ci.yml`).
- **0 high-severity** issues per Slither on commit `v0.1.0`.
- External audit scheduled with **Statemind** (slot confirmed: 12 Aug 2025).

---

## 🤝 Contributing

We welcome contributions from the community. If you're interested in improving Builder-Hub, please read our [**Contributing Guide**](CONTRIBUTING.md) to learn about our development process, coding conventions, and deployment procedures.

---

## 👥 Core team

| Name         | Role               | Github / X                               |
| ------------ | ------------------ | ---------------------------------------- |
| **Ed S. F.** | Lead Solidity / zk | [@edsphinx](https://github.com/edsphinx) |

---

## ✍️ Licence

MIT – see [LICENSE](LICENSE).

> We believe **open infrastructure drives adoption**.
> Fork it, remix it, ship it – just keep the attribution.

---

_Made with ♥ in Honduras & deployed on Base, Arbitrum and Scroll._
