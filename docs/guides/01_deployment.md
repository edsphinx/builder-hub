# GasX Protocol: Deployment Guide

This document provides a comprehensive guide for deploying the GasX Protocol smart contracts. Following these steps will ensure a consistent, safe, and verifiable deployment process.

---
## 1. Initial Setup

This only needs to be done once when setting up a new development environment.

### 1.1. Install Dependencies
Ensure you are at the root of the monorepo (`builder-hub/`).
```bash
yarn install
```
> **Note:** If you encounter dependency issues, the most reliable solution is a full clean install: `rm -rf node_modules packages/*/node_modules yarn.lock && yarn install`.

### 1.2. Configure Environment Variables
Navigate to the Hardhat package and create an environment file by copying the example.
```bash
cd packages/hardhat
cp .env.example .env
```
Now, edit the `.env` file and fill in all the necessary variables:
- `DEPLOYER_PRIVATE_KEY`: The private key of the wallet you will use for deployments.
- `ALCHEMY_API_KEY`: Your API key from Alchemy (or another RPC provider).
- `ETHERSCAN_API_KEY`: Your single, master Etherscan API key.
- All network-specific variables as defined in `config/networks.ts` (e.g., `ARBITRUM_SEPOLIA_PAYMASTER_TREASURY`, `ARBITRUM_SEPOLIA_DIA_ORACLE_ADDRESS`, etc.).

---
## 2. Local Deployment & Testing (Hardhat Network)

This is the standard workflow for local development and for running unit/integration tests.

### 2.1. Compile Contracts
Ensure all contracts are compiled and type definitions are generated.
```bash
# From packages/hardhat/
yarn compile
```

### 2.2. Run a Full Local Deployment
This command executes all scripts in the `/deploy` folder on a fresh, temporary Hardhat instance.
```bash
# From packages/hardhat/
yarn deploy --network hardhat
```

### 2.3. Run All Tests
After a successful local deployment, run the entire test suite to ensure no regressions have been introduced.
```bash
# From packages/hardhat/
yarn test
```

---
## 3. Public Testnet Deployment (Example: Arbitrum Sepolia)

This process should be followed for the first-time deployment to any new live network.

### 3.1. Pre-Flight Checklist
- [ ] **Confirm `.env`:** Double-check that all variables for the target network (e.g., `ARBITRUM_SEPOLIA_...`) are correct in your `.env` file.
- [ ] **Fund Deployer Wallet:** Ensure your deployer wallet has sufficient native gas tokens on the target network (e.g., ETH on Arbitrum Sepolia).

### 3.2. Execute Full Deployment
Run the `deploy` command, specifying the target network. This will execute all deployment scripts in order and attempt to verify all contracts on the corresponding block explorer.
```bash
# From packages/hardhat/
yarn deploy --network arbitrumSepolia
```

### 3.3. Post-Deployment Configuration
After the contracts are deployed, you must run scripts to configure their initial state.

**1. Fund the Paymaster:** Deposit ETH into the `EntryPoint` for your `GasXWhitelistPaymaster`.
```bash
# From packages/hardhat/
NETWORK=arbitrumSepolia yarn fund-paymaster
```

**2. Configure DIA Adapters:** Deploy the chain-specific `DIAAdapterFactory` and its oracle adapters.
```bash
# From packages/hardhat/
yarn deploy --network arbitrumSepolia --tags DIA_Adapters_Setup
```

**3. Set Whitelist & Limits:** Run any administrative scripts to configure the paymaster's rules (e.g., `setSelector`, `setLimit`).
```bash
# Example for a hypothetical script
NETWORK=arbitrumSepolia yarn hardhat run scripts/configureWhitelist.ts
```

### 3.4. Final Verification
- **Block Explorer:** Manually check Arbiscan (or the relevant explorer) to confirm all contracts are deployed and verified.
- **E2E Test:** Run your public E2E test suite against the newly deployed contracts to ensure the entire system is functioning correctly.
```bash
# From packages/hardhat/
yarn hardhat test test/GasX.e2e.public.test.ts --network arbitrumSepolia
```
