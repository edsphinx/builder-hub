# Naming Conventions & Best Practices

This document outlines the standardized naming conventions and best practices for the GasX Protocol codebase. Adhering to these standards is crucial for maintaining clarity, consistency, and professionalism across the project.

---
## 1. Smart Contracts (`/contracts`)

### 1.1. Core Principle
Contract names should be descriptive, unambiguous, and follow a `Brand-Role` pattern.

### 1.2. Naming Convention
- **Prefix:** All core protocol contracts must be prefixed with `GasX`.
- **Suffix:** The name must end with the contract's architectural role (e.g., `Paymaster`, `Config`, `Module`).
- **Strategy:** For contracts implementing a specific strategy, that strategy should be in the name.

### 1.3. Examples

| Purpose | ✅ Good | ❌ Bad |
| :--- | :--- | :--- |
| Whitelist Paymaster | `GasXWhitelistPaymaster.sol` | `GasX.sol`, `Sponsorship.sol` |
| ERC20 Fee Paymaster | `GasXERC20FeePaymaster.sol` | `USGSPaymaster.sol` |
| Configuration | `GasXConfig.sol` | `Config.sol`, `GasXParams.sol`|
| NFT Validation Module | `NFTGatedValidationModule.sol` | `NFTChecker.sol` |

---
## 2. Deployment Scripts (`/deploy`)

### 2.1. Core Principle
Deployment scripts must be numbered sequentially and grouped by their purpose to ensure a predictable and logical execution order.

### 2.2. Numbering Convention
- **`00-09`:** Core Protocol Contracts (e.g., `MultiOracleAggregator`, `GasXConfig`, `GasXWhitelistPaymaster`).
- **`10-19`:** Mock Contracts & Local Test Setup (e.g., `MockTarget`, `MockOracle`).
- **`20-29`:** Testnet-Specific Configurations (e.g., deploying and configuring adapters for a specific testnet).
- **`30-39`:** Mainnet-Specific Configurations.

### 2.3. Examples

| Purpose | ✅ Good | ❌ Bad |
| :--- | :--- | :--- |
| Deploying the config | `04_deploy_gasxconfig.ts` | `deploy_config.ts` |
| Deploying mocks | `10_deploy_mock_target.ts` | `05_deploy_mocks.ts` |
| Setting up DIA on a testnet | `20_deploy_dia_arbitrum_sepolia.ts`| `deploy_dia.ts` |

---
## 3. Operational Scripts (`/scripts`)

### 3.1. Core Principle
Scripts intended for manual, administrative tasks should be prefixed to distinguish them from build utilities. They must be chain-agnostic.

### 3.2. Naming Convention
- **NPM Script (`package.json`):** Use the `op:` prefix (for "operation"). The name should be a clear, verb-based action (e.g., `op:fund-paymaster`).
- **File Name (`/scripts`):** The file should have a descriptive, camelCase name (e.g., `fundPaymaster.ts`).
- **Operational Scripts:** Potentially dangerous or critical scripts (like upgrades) should be placed in a dedicated `/scripts/operations` directory.

### 3.3. Examples

| Purpose | `package.json` Command | File Name |
| :--- | :--- | :--- |
| Funding a paymaster | `op:fund-paymaster` | `scripts/fundPaymaster.ts` |
| Upgrading a contract | `op:upgrade-aggregator`| `scripts/operations/upgrade_multiaggregator_v2.ts`|
| Setting USD limits | `op:set-usd-limits` | `scripts/loadAndSetMaxUsd.ts` |

---
## 4. Environment Variables (`.env`)

### 4.1. Core Principle
Variables must be clearly namespaced by network to prevent accidental cross-configuration and to keep the `.env` file organized.

### 4.2. Naming Convention
- **Format:** `<NETWORK_NAME_IN_UPPER_SNAKE_CASE>_<VARIABLE_NAME>`
- **Organization:** The `.env` file should be grouped by network using commented headers.

### 4.3. Examples

| Purpose | ✅ Good | ❌ Bad |
| :--- | :--- | :--- |
| Arbitrum Sepolia Treasury | `ARBITRUM_SEPOLIA_PAYMASTER_TREASURY` | `PAYMASTER_TREASURY_ARBITRUM_SEPOLIA`, `ARB_SEPOLIA_TREASURY` |
| Scroll Sepolia Oracle Signer| `SCROLL_SEPOLIA_ORACLE_SIGNER` | `ORACLE_SIGNER_SCR_SEPOLIA` |

---
## 5. Test Files (`/test`)

### 5.1. Core Principle
Test files should be named after the contract they are testing and suffixed with the type of testing they perform.

### 5.2. Naming Convention
- **Format:** `<ContractName>.<TestType>.ts`
- **Test Types:**
    - `.test.ts` or `.full.test.ts`: For comprehensive unit and integration tests.
    - `.e2e.local.test.ts`: For end-to-end tests on a local Hardhat network.
    - `.e2e.public.test.ts`: For end-to-end tests on a live public testnet.

### 5.3. Examples

| Purpose | ✅ Good | ❌ Bad |
| :--- | :--- | :--- |
| Unit tests for the paymaster| `GasXWhitelistPaymaster.full.test.ts`| `TestGasX.ts` |
| E2E test on a testnet | `GasXWhitelistPaymaster.e2e.public.test.ts`| `PublicTest.ts`|
