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
