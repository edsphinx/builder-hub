# Security Policy for the GasX Protocol

The GasX Protocol team and community take the security of our smart contracts and infrastructure very seriously. We are committed to ensuring the safety of our users and their funds.

---
## 🛡️ Reporting a Vulnerability

If you discover a security vulnerability, we strongly encourage you to report it responsibly.

**Please DO NOT open a public GitHub issue.**

Instead, please send a detailed report to our private security contact:

**[edsphinx@gmail.com](mailto:edsphinx@gmail.com)** *(Replace with your actual private security email)*

Please include the following in your report:
- A detailed description of the vulnerability.
- The contract(s) and network(s) affected.
- Steps to reproduce the issue.
- Any potential impact you have identified.

We will acknowledge your report within 48 hours and will work with you to understand and resolve the issue. We plan to offer a bug bounty program in the future to reward researchers for their contributions.

---
##  implemented Security Measures

The GasX Protocol is built with a security-first mindset. The following measures and best practices are currently in place:

### 1. Smart Contract Security
- **Immutable First:** All V1 paymaster contracts are deployed as **immutable** to provide maximum trust and prevent malicious upgrades.
- **Separation of Concerns:** The protocol is broken into small, single-responsibility contracts (e.g., `GasXWhitelistPaymaster`, `GasXConfig`). This minimizes the attack surface of each component.
- **Use of Audited Libraries:** We rely on the latest, battle-tested libraries from OpenZeppelin for critical operations like `Ownable` and `ECDSA`.
- **Defensive Programming:** Contracts include robust checks for all inputs, such as the "fail-fast" validation logic, gas limit ceilings, and on-chain oracle price deviation checks.
- **Professional Testing:** The project has a comprehensive test suite, including unit, integration, and end-to-end tests, with high code coverage.

### 2. Operational Security
- **Multi-Chain Configuration:** All network-specific addresses and parameters are managed in a central configuration file and injected at deployment, preventing hardcoding errors.
- **Professional Deployment Workflow:** We use a standardized suite of Hardhat scripts and a `DEPLOYMENT_GUIDE.md` to ensure deployments are repeatable and safe.
- **Pre-Flight Checks:** A `check:preflight` script is used to validate the environment and on-chain state before running critical operations on a live network.

---
##  audits

- **Internal Review:** The codebase has undergone extensive internal peer review.
- **Static Analysis:** We use tools like Slither in our CI/CD pipeline to automatically check for common vulnerabilities.
- **External Audit:** A professional, third-party security audit is planned as a key milestone in our **[Roadmap](./docs/overview/02_roadmap.md)** before any significant mainnet deployment with user funds at scale.
