# Changelog

All notable changes to this project will be documented in this file.

---

## [v0.3.0] – 2025-09-18

This version marks a major architectural overhaul, transforming the project into a professional, multi-chain-ready protocol with a clear and scalable foundation.

### Refactor - **Project-Wide Professionalization**
- **Contract Naming & Structure:** All core contracts were renamed to a professional `GasX<Role>Paymaster` convention and moved to a `/contracts/core` directory. The "GasX Suite" concept was formally adopted.
- **Multi-Chain Tooling:** All deployment scripts, operational scripts, and Hardhat configurations were refactored to be fully chain-agnostic, removing hardcoded values and dynamically loading configuration from a central `config/networks.ts` file.
- **Security Strategy:** V1 paymaster contracts have been defined as **immutable** to provide maximum trust and security for initial partners. Upgradeability is now a planned V2 feature to be managed by a Timelock.

### Features
- **Professional `package.json` Scripts:** The NPM scripts have been reorganized into a logical "command center" for all development, testing, and operational tasks.
- **Robust Deployment Workflow:** Implemented professional deployment practices, including a `DEPLOYMENT_GUIDE.md`, a `pre_flight_check.ts` script, dynamic dependency management, and consistent, standardized logging.

### Documentation
- **Complete Documentation Overhaul:** The entire `/docs` folder was restructured into a professional hierarchy (`overview`, `guides`, `contracts`).
- **New Core Documents:** Added definitive guides for `ARCHITECTURE`, `ROADMAP`, `NAMING_CONVENTIONS`, and detailed technical references for each core smart contract.
- **Language Standardization:** All documentation, comments, and logs across the entire project have been standardized to professional English.

---

## [v0.2.0] – 2025-07-21

### Features

- **EntryPoint v0.8.0 Compatibility:** Refactored `GasX.sol` to be fully compatible with the latest EntryPoint version, including the updated `paymasterAndData` structure.
- **Frontend Demonstration:** Implemented a new page (`/gasless-pro`) in the Next.js app to provide a user-facing demonstration of the gasless transaction flow on Scroll Sepolia.
- **Frontend Refactoring:** The frontend logic was refactored to separate concerns, creating a dedicated `permissionlessService.ts` and a `useGaslessTransaction.ts` hook for improved maintainability and reusability.

### Fixes

- **E2E Test Suite Repair:** Repaired and stabilized the entire E2E test suite, including both local and public network tests (`GasX.e2e.local.test.ts`, `GasX.e2e.public.test.ts`).
- **Mock Contracts:** Corrected the `MockTarget.sol` contract to include a counter for proper state verification in tests.

### Chore

- **Repository Cleanup:** Removed multiple redundant test files and cleaned up commented-out code.
- **CI Workflow:** Corrected the working directory configuration in `.github/workflows/ci.yml` to resolve build failures.
- **Documentation:** Updated all major documentation files (`README.md`, `ARCHITECTURE.md`, `FUTURE_FEATURES.md`, `STATUS.md`, `SESSION_SUMMARY.md`) to reflect the current state of the project.

---

## [v0.1.1] – 2025-07-03

### Documentation

- Updated `README.md` to reflect completed integration of external `Config.sol`.
- Added details on config deployment script and helper usage (`useConfig.ts`).
- Included max USD subsidy cap logic via new scripts (`setMaxUsd.ts`, `bulkSetMaxUsd.ts`).

> This marks the documentation sync point after major Config refactor.
