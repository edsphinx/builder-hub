# Gasless Paymaster (ERC-4337)

<!-- README.md – Gasless Paymaster (ERC-4337) -->

![Gasless Paymaster](<https://github.com/edsphinx/builder-hub/main/.github/banner.svg> =640x)

{: .center}
**Production-ready ERC-4337 Paymaster that subsidises USDC check-outs across Base, Arbitrum & Scroll**
_Composable, upgrade-safe and 100 % open-source_
[![CI](https://github.com/edsphinx/builder-hub/workflows/CI/badge.svg)](https://github.com/edsphinx/builder-hub/actions)
[![Chat](https://img.shields.io/badge/chat-Telegram-blue?logo=telegram)](https://t.me/edsphinx)
[LICENSE](LICENSE)
![MIT License](https://img.shields.io/badge/License-MIT-success)

---

## ✨ Why this matters

On-chain commerce stalls when new users must first acquire ETH for gas.  
Our **Gasless Paymaster** (ERC-4337, EntryPoint v0.8) removes that friction:

- **No custodial wallets** – users pay in native **USDC** while the Paymaster covers gas.
- **Bridges built-in** – integrates Circle CCTP for cross-chain liquidity.
- **Real-time notifications** – Push Protocol hooks inform buyers the instant their mint/checkout succeeds.
- **Ready for production** – upgrade-safe storage gap, exhaustive Foundry + Hardhat tests, CI, linting and static analysis baked in.

This repo is the foundation of our multi-chain **Gasless Checkout Module** submitted to the following grant tracks:

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

```

packages/
├─ hardhat/ # Solidity contracts + Foundry tests
│ └─ contracts/
│ ├─ GaslessPaymaster.sol
│ ├─ modifiers/… # guard libraries
│ └─ mocks/…
├─ nextjs/ # demo storefront (Scaffold-ETH 2)
│ └─ app/
│ └─ checkout/… # React route using the Paymaster SDK
└─ docs/ # Grant PDFs & diagrams

```

_One mono-repo – contracts, front-end demo and docs live together, simplifying review & CI._

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

## 🛠️ Key smart-contract features

| Feature                              | Detail                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| **EntryPoint v0.8**                  | Cancun-ready, supports EIP-1153 TransientStorage.                                    |
| **Strict selector whitelist**        | Only explicitly allowed functions can be gas-sponsored, preventing malicious drains. |
| **Soft gas ceiling per UserOp**      | Stops griefing attacks by limiting `callGasLimit`.                                   |
| **Upgradeable (UUPS)**               | 50-slot storage gap, `_disableInitializers` guard, OZ 5.1 patterns.                  |
| **PostOp analytics hook**            | Emits `GasSponsored(sender, gasUsed, feeWei)` for off-chain dashboards.              |
| **Oracle-priced subsidies (opt-in)** | `paymasterAndData = abi.encode(expiry, sig…)` enables off-chain USDC price checks.   |

See [contracts/hardhat/contracts/GaslessPaymaster.sol](packages/hardhat/contracts/GaslessPaymaster.sol) for inline NatSpec.

---

## ✅ Grant checklist – Week 1 deliverable

| Item                                                         | Status |
| ------------------------------------------------------------ | :----: |
| **EntryPoint 0.8** deployed to Base Sepolia & Scroll Sepolia |   ✔︎   |
| **GaslessPaymaster** verified on Explorer + Sourcify         |   ✔︎   |
| **Demo checkout** (Next.js route) showing 0 ETH gas cost     |   ✔︎   |
| 15 s GIF + Loom walkthrough in `/docs/`                      |   ✔︎   |
| Unit + integration tests ≥ 90 % line coverage                |   ✔︎   |
| MIT licence, CODEOWNERS, SECURITY.md                         |   ✔︎   |

All items bundled in commit `v0.1.0` and immutable on GitHub.

---

## 🚀 Roadmap

| Phase   | Milestone                                   | Target week |
| ------- | ------------------------------------------- | ----------- |
| **α**   | Merge Paymaster into Scaffold-ETH 2 starter | W-2         |
|         | Push Protocol notifications                 | W-2         |
|         | ArbiFuel CSV gas tracker (Node CLI)         | W-3         |
| **β**   | Scroll vault composer + restake router      | W-7         |
| **1.0** | Multi-chain SDK (npm) + audited contracts   | Sep 2025    |

Detailed Gantt in `docs/roadmap.pdf`.

---

## 🔒 Security & audits

- Slither, Echidna and Foundry invariants run in GitHub Actions (`.github/workflows/ci.yml`).
- **0 high-severity** issues per Slither on commit `v0.1.0`.
- External audit scheduled with **Statemind** (slot confirmed: 12 Aug 2025).

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
