# Contributing Guide

Thank you for your interest in contributing to Builder-Hub! This guide details the conventions and processes we follow to keep the project tidy and consistent.

## Development Workflow

1.  **Clone the repository:** `git clone https://github.com/edsphinx/builder-hub.git`
2.  **Install dependencies:** `yarn install`
3.  **Compile contracts:** `yarn compile` (inside `packages/hardhat`)
4.  **Run tests:** `yarn test` (inside `packages/hardhat`)

## Deployment and Verification Process

Our deployment process is automated to ensure consistency and safety. Contract verification and deployment history updates are part of this flow.

### General Command

The base command for any deployment to a public network is:

```bash
yarn deploy --network <network_name> --tags <tags_to_deploy>,GenerateHistory
```

### Key Points

1.  **Automatic Verification:** The deployment scripts will automatically trigger the verification task for each contract on public networks. No manual step is needed.

2.  **Deployment History (`GenerateHistory`):**
    - To record a deployment in the `deployHistory.md` file, **you must always append the `GenerateHistory` tag** to your `--tags` list.
    - This ensures that the `99_generate_history.ts` script runs at the end and documents everything deployed in that session.
    - If you omit this tag, the deployment will proceed but will not be logged, which is useful for debugging but not for official deployments.

### Practical Examples

- **To deploy all contracts to `scrollSepolia` and log it:**
  ```bash
  yarn deploy --network scrollSepolia --tags GenerateHistory
  ```

- **To deploy only the `WalletFuel` contract to `scrollSepolia` and log it:**
  ```bash
  yarn deploy --network scrollSepolia --tags WalletFuel,GenerateHistory
  ```

- **To perform a test deployment without logging it to the history:**
  ```bash
  yarn deploy --network scrollSepolia --tags WalletFuel
  ```
