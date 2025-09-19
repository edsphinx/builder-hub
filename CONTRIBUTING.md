# Contributing to the GasX Protocol

Thank you for your interest in contributing to the GasX Protocol and Builder-Hub! We welcome contributions from the community. This guide outlines the conventions and processes we follow to maintain a high-quality, consistent, and professional codebase.

---
## 🚀 Getting Started

To get the project running locally, please follow these steps. All commands should be run from their respective workspace directories as noted.

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/edsphinx/builder-hub.git](https://github.com/edsphinx/builder-hub.git)
    cd builder-hub
    ```

2.  **Install Dependencies:**
    This command installs all dependencies for the entire monorepo.
    ```bash
    yarn install
    ```

3.  **Compile Smart Contracts:**
    Navigate to the Hardhat package and compile the contracts.
    ```bash
    cd packages/hardhat
    yarn compile
    ```

4.  **Run Local Tests:**
    Execute the full test suite to ensure your environment is set up correctly.
    ```bash
    # From packages/hardhat/
    yarn test
    ```

---
## 💻 Contribution Workflow

We follow a standard Git workflow to ensure a clean and understandable project history.

1.  **Branching:** Create a new feature branch from the `main` branch. Please use a descriptive branch name (e.g., `feat/erc20-paymaster` or `fix/oracle-adapter-bug`).
2.  **Committing:** We use the [**Conventional Commits**](https://www.conventionalcommits.org/en/v1.0.0/) standard. This helps automate releases and makes the project history readable.
    -   **Examples:** `feat(paymaster): Add ERC20 fee payment logic`, `fix(deploy): Correct EntryPoint address resolution`, `docs(readme): Update project vision`.
3.  **Code Quality:** Before committing, please run the linter and formatter.
    ```bash
    # From packages/hardhat/
    yarn format
    yarn lint:fix
    ```
4.  **Pull Request (PR):** Push your branch to the repository and open a Pull Request against the `main` branch. Please provide a clear description of the changes you have made.

---
## 📜 Standards & Conventions

To maintain a high standard of quality, we adhere to the following conventions:

-   **Naming Conventions:** All contributions must follow the standards outlined in our official [**Naming Conventions Guide**](./docs/project/01_naming_conventions.md).
-   **Documentation:** All new features should be accompanied by relevant documentation updates (e.g., updating a contract's technical reference in the `/docs/contracts` folder).

---
## 🚀 Deployment Process

Our deployment process is automated via Hardhat scripts. For a complete, step-by-step guide on deploying the protocol, please refer to the official [**Deployment Guide**](./DEPLOYMENT_GUIDE.md).

The general command for deploying to a network is:
```bash
# From packages/hardhat/
yarn deploy --network <network_name>
```

---
## 🐞 Reporting Issues

If you find a bug or have a feature request, please [open an issue](https://github.com/edsphinx/builder-hub/issues) on our GitHub repository. Provide as much detail as possible, including the network, contract versions, and steps to reproduce the issue.
