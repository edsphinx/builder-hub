# Contract Reference: `GasXConfig.sol`

This document provides a detailed technical reference for the `GasXConfig` contract.

- **Source Code:** [`contracts/core/GasXConfig.sol`](../../contracts/core/GasXConfig.sol)
- **Type:** Configuration / Registry

## 1. Overview

The `GasXConfig` contract serves as a centralized, on-chain "settings panel" for the GasX Protocol. Its primary purpose is to store **operational parameters** that may need to be updated over the protocol's lifetime without requiring a redeployment of the core paymaster contracts.

By separating dynamic settings from the core logic, this contract enhances the security, maintainability, and flexibility of the entire system.

## 2. Core Purpose & Integration

The most critical role of `GasXConfig` is to manage the list of trusted **oracle signers**.

The paymaster contracts (`GasXWhitelistPaymaster`, `GasXERC20FeePaymaster`) are deployed with an `immutable` address pointing to this `GasXConfig` instance. When a paymaster needs to verify an off-chain signature, it does not store the signer's address itself. Instead, it makes an external call to `GasXConfig` to fetch the currently authorized signer address.

### Example Integration
```solidity
// Inside a GasX Paymaster contract...

// The address of the config contract is set permanently at deployment.
address public immutable config;

// In the signature validation logic...
function _verifyOracleSig(...) private view {
    // Fetches the up-to-date signer address from the external config contract.
    address expectedSigner = IGasXConfig(config).oracleSigner();
    
    // ...proceeds to verify the signature against the expectedSigner.
    require(recoveredSigner == expectedSigner, "GasX: Unauthorized signer");
}
```

## 3. Key Functions (`onlyOwner`)

- **`setOracleSigner(address newSigner)`:** Allows the contract owner to update the address of the trusted off-chain oracle signer. This is a critical function for key rotation and security.
- **`setMaxUsd(bytes4 selector, uint256 maxUsd)`:** Sets the maximum USD subsidy limit for a specific function selector.
- **`bulkSetMaxUsd(bytes4[] selectors, uint256[] maxUsds)`:** An efficient batch function to update the USD limits for multiple selectors in a single transaction.

## 4. Events

- **`OracleUpdated(address newSigner)`:** Emitted when the `oracleSigner` is successfully changed.
- **`MaxUsdSet(bytes4 selector, uint256 maxUsd)`:** Emitted whenever a USD limit is set for a selector.

## 5. Benefits of this Architecture

- **Decoupling:** Critical paymaster logic is separated from updatable settings.
- **Enhanced Security:** The `oracleSigner` key can be rotated at any time without a complex and risky upgrade of the paymaster contracts.
- **Gas Efficiency:** The paymasters store only a single `immutable` address to the config, saving storage costs, while the configuration itself can grow.
