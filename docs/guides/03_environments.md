# Guide: Environment-Specific Behavior

The GasX Protocol's contracts and deployment scripts are designed to behave differently based on the target environment (`Dev`, `Testnet`, `Production`). This ensures a safe and flexible workflow for development, testing, and mainnet operations.

## How it Works

The environment is determined dynamically in our Hardhat scripts by the `helpers/environment.ts` utility. This utility classifies the network (`hardhat`, `arbitrumSepolia`, `mainnet`, etc.) into one of three environments, represented by an `Enum` in the contracts.

This `Environment` enum is then passed into the constructor of key contracts like `GasXWhitelistPaymaster`.

## Key Behavioral Differences

The primary difference is in how the paymaster handles the validation of off-chain oracle signatures, which is a critical feature for both security and testing.

| Behavior | `Dev` (e.g., hardhat, localhost) | `Testnet` / `Production` |
| :--- | :--- | :--- |
| **Oracle Signature Check** | **Bypassed.** The `_verifyOracleSig` function returns immediately. | **Enforced.** The signature is required and fully validated against the authorized signer. |
| **`isDev()` function** | Returns `true`. | Returns `false`. |

This design allows for easy and rapid local testing without the need to run a full off-chain signing service, while ensuring maximum security is enforced on all live public networks.

---
## 🛡️ Best Practices & Recommendations

To ensure a clear and safe separation between environments, the project adheres to the following principles:

- **Use `Dev` for Local Testing:** The `Dev` environment is strictly for local testing and simulations where security checks can be relaxed for convenience.
- **Use Dynamic Environment Resolution:** Always use the `resolveEnvironment()` helper in deployment scripts to determine the environment. Do not hardcode the `Environment` enum.
- **Centralize Configuration:** All network-specific addresses and parameters are managed in the central `config/networks.ts` file to avoid hardcoding values in scripts.

Adhering to these practices guarantees a predictable, automated, and safe deployment workflow, reducing the risk of human error.
