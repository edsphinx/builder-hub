# Guide: Local Dependency Management (`aa-lib`)

This document explains the "Local AA Vendor" system, a set of scripts used to manage the `@account-abstraction/contracts` dependency for the Hardhat workspace.

## 1. Overview

Instead of relying solely on Yarn/NPM to manage the `account-abstraction` contracts, this project includes a set of shell scripts (`aa-init.sh`, `aa-clean.sh`) to manage a local clone of the repository. This is a practice known as "vendoring."

The `yarn aa:init` command clones a specific version of the official repository into `packages/aa-lib` and then copies the required contracts into `packages/hardhat/contracts`.

## 2. Rationale

This system was implemented to solve several common issues in complex Hardhat monorepos:

-   **Compilation Stability:** It provides the Hardhat compiler with a direct and unambiguous path to the `EntryPoint.sol` source code, eliminating potential "artifact not found" errors that can arise from deep `node_modules` nesting.
-   **Precise Version Pinning:** It locks the project to a specific version (`releases/v0.8`) of the `account-abstraction` contracts, protecting against unintended updates from the NPM package.
-   **Enhanced Debugging:** It allows core developers to temporarily add `console.log` or other modifications to the dependency's source code for deep debugging, which is not possible with a standard NPM installation.

## 3. Workflow

This system is primarily intended for **local development and debugging**.

-   **To set up the local vendor:**
    ```bash
    # From the project root
    yarn aa:init
    ```

-   **To remove the local vendor:**
    ```bash
    # From the project root
    yarn aa:clean
    ```

> **Note:** The `packages/aa-lib` directory is explicitly excluded from Yarn's workspaces in the root `package.json`.

## 4. CI/CD Integration

The `yarn aa:init` command is currently **commented out** in the `.github/workflows/ci.yml` file.

This is a deliberate choice. The CI pipeline is configured to use the standard, unmodified version of the package from `node_modules` to ensure our contracts are compatible with the official public release. The local vendoring system remains a powerful tool for solving complex local development and debugging challenges.
