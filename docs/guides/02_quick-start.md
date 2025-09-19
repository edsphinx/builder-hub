# Quick Start Guide

This guide provides the essential steps to clone the GasX Protocol repository, install its dependencies, and run the full test suite on a local Hardhat network.

## Prerequisites

-   **Node.js:** v20.19.3 or higher
-   **Yarn:** v3.x or higher
-   **Git**

---
## 1. Clone the Repository

First, clone the project from GitHub to your local machine.
```bash
git clone [https://github.com/edsphinx/builder-hub.git](https://github.com/edsphinx/builder-hub.git)
cd builder-hub
```

---
## 2. Install Dependencies

The project is a monorepo managed with Yarn Workspaces. Install all dependencies from the root directory.
```bash
yarn install
```
> **Note:** This command will install dependencies for all packages, including `hardhat` and `nextjs`. It may take a few minutes on the first run.

---
## 3. Compile the Smart Contracts

Navigate to the `hardhat` package and compile the Solidity contracts. This will also generate TypeChain bindings.
```bash
cd packages/hardhat
yarn compile
```

---
## 4. Run the Local Test Suite

The best way to verify your setup is to run the complete test suite. This command will compile the contracts, deploy them to a temporary local Hardhat network, and run all unit and integration tests.

```bash
# From the packages/hardhat/ directory
yarn test
```

If all tests pass, your local development environment is correctly set up and you are ready to start contributing.

---
## Next Steps

-   For a detailed guide on deploying to a live network, see the **[Deployment Guide](./01_deployment.md)**.
-   To understand the project's architecture, read the **[Architecture Overview](../overview/01_architecture.md)**.
