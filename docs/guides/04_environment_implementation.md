# Guide: Environment-Specific Behavior

The GasX Protocol is designed to operate safely and flexibly across different environments (`Dev`, `Testnet`, `Production`). This is achieved through a combination of on-chain logic and off-chain deployment helpers that dynamically configure the system based on the target network.

---
## 1. On-Chain Implementation (Solidity)

The core logic resides in the `GasXWhitelistPaymaster` contract, which uses a public `enum` to represent the current environment.

### 1.1. State Declaration
```solidity
// In contracts/core/GasXWhitelistPaymaster.sol
enum Environment {
    Dev,
    Testnet,
    Production
}

Environment public environment;
```

### 1.2. Initialization
The `environment` is set immutably in the constructor, configured by the deployment script for the target network.
```solidity
constructor(
    // ...
    Environment _environment
) {
    // ...
    environment = _environment;
}
```

### 1.3. Conditional Logic
The primary use case is to relax certain security checks during local development. For example, the expensive oracle signature verification is bypassed in `Dev` mode.

```solidity
// In _verifyOracleSig(...)
if (isDev()) {
    return; // Skip signature check in dev mode
}
```
This is facilitated by the `isDev()` view function, which provides a clean way to check the environment.

---
## 2. Off-Chain Configuration (TypeScript)

The environment is determined and injected into the contract dynamically during deployment.

### 2.1. Dynamic Environment Resolution
A centralized helper function in `packages/hardhat/helpers/environment.ts` is the single source of truth for classifying networks. It uses a robust, explicit whitelisting model for safety.

```typescript
// In helpers/environment.ts
export function resolveEnvironment(networkName: string): Environment {
  if (networkName === 'hardhat' || networkName === 'localhost') {
    return Environment.Dev;
  }
  // ... logic to check for Testnet or Production ...
}
```

### 2.2. Deployment Script Integration
The deployment script for the paymaster (e.g., `05_deploy_gasxwhitelistpaymaster.ts`) imports this helper and passes the result into the contract's constructor.

```typescript
// In deploy/05_deploy_gasxwhitelistpaymaster.ts
const environment: Environment = resolveEnvironment(network.name);
// ...
const deployResult = await deploy("GasXWhitelistPaymaster", {
  from: deployer,
  args: [/*...,*/ environment],
  log: true,
});
```

---
## 3. Summary: Dev vs. Production Behavior

This system creates a clear and safe distinction between local development and live networks.

| Behavior | `Dev` (e.g., hardhat) | `Testnet` / `Production` |
| :--- | :--- | :--- |
| **Oracle Signature Check** | **Bypassed.** | **Enforced.** |
| **`isDev()` returns** | `true` | `false` |
| **Security Posture** | Relaxed for testing | Maximum |

This guarantees a predictable and automated deployment workflow, reducing the risk of human error when moving between environments.