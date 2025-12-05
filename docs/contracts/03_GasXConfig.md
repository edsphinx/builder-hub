# Contract Reference: `GasXConfig.sol`

This document provides a detailed technical reference for the `GasXConfig` contract.

- **Source Code:** [`contracts/core/GasXConfig.sol`](../../packages/hardhat/contracts/core/GasXConfig.sol)
- **Type:** Configuration / Registry

## 1. Overview

The `GasXConfig` contract serves as a centralized, on-chain "settings panel" for the GasX Protocol. Its primary purpose is to store **operational parameters** that may need to be updated over the protocol's lifetime without requiring a redeployment of the core paymaster contracts.

By separating dynamic settings from the core logic, this contract enhances the security, maintainability, and flexibility of the entire system.

### Key Security Features
- **Immutable Owner:** The contract owner is set at deployment and cannot be changed.
- **Zero Address Validation:** Critical functions reject zero address inputs.
- **Custom Errors:** Gas-efficient custom errors (`ZeroAddress`, `LengthMismatch`).
- **Comprehensive Events:** All state changes emit events with both previous and new values for auditability.

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

## 3. State Variables

| Name | Type | Description |
|------|------|-------------|
| `owner` | `address immutable` | Contract owner (set at deployment, cannot change) |
| `oracleSigner` | `address` | Address authorized to sign oracle payloads |
| `maxUsdPerSelector` | `mapping(bytes4 => uint256)` | Max USD subsidy per function selector (6 decimals) |

## 4. Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `OracleSignerUpdated` | `address indexed previousSigner, address indexed newSigner` | Emitted when oracle signer is changed |
| `MaxUsdSet` | `bytes4 indexed selector, uint256 previousMaxUsd, uint256 newMaxUsd` | Emitted when a selector's max USD is set |

## 5. Custom Errors

| Error | Description |
|-------|-------------|
| `ZeroAddress()` | Thrown when zero address is provided to constructor or setOracleSigner |
| `LengthMismatch()` | Thrown when bulkSetMaxUsd arrays have different lengths |

## 6. Admin Functions (`onlyOwner`)

### `setOracleSigner(address newSigner)`
Updates the address of the trusted off-chain oracle signer.

**Parameters:**
- `newSigner`: New oracle signer address (cannot be zero)

**Reverts:**
- `ZeroAddress()` if `newSigner` is zero address
- `"not owner"` if caller is not the owner

**Emits:** `OracleSignerUpdated(previousSigner, newSigner)`

### `setMaxUsd(bytes4 selector, uint256 maxUsd)`
Sets the maximum USD subsidy limit for a specific function selector.

**Parameters:**
- `selector`: 4-byte function selector
- `maxUsd`: Maximum subsidy in USD (6 decimals, e.g., 100_000_000 = $100)

**Emits:** `MaxUsdSet(selector, previousMaxUsd, newMaxUsd)`

### `bulkSetMaxUsd(bytes4[] calldata selectors, uint256[] calldata maxUsds)`
Batch update of max USD subsidy for multiple selectors.

**Parameters:**
- `selectors`: Array of function selectors
- `maxUsds`: Array of max USD values (must match selectors length)

**Reverts:**
- `LengthMismatch()` if arrays have different lengths

**Emits:** `MaxUsdSet` for each selector

## 7. View Functions

### `getMaxUsd(bytes4 selector) returns (uint256 maxUsd)`
Returns the max allowed USD subsidy for a given selector.

### `getAllLimits(bytes4[] calldata selectors) returns (uint256[] memory)`
Returns an array of USD caps for the given selectors.

## 8. Security Considerations

1. **Immutable Owner:** The owner cannot be transferred. This is intentional for maximum security - deploy a new contract if owner change is needed.

2. **Zero Address Protection:** The oracle signer cannot be set to zero address, preventing accidental lockout.

3. **Event Auditability:** All events include previous values, making it easy to audit configuration changes.

4. **No Pausability:** This contract has no pause mechanism. If compromised, deploy a new config and update paymasters.

5. **Selector Limits:** Setting `maxUsd` to 0 effectively disables subsidies for that selector.

## 9. Benefits of this Architecture

- **Decoupling:** Critical paymaster logic is separated from updatable settings.
- **Enhanced Security:** The `oracleSigner` key can be rotated at any time without a complex and risky upgrade of the paymaster contracts.
- **Gas Efficiency:** The paymasters store only a single `immutable` address to the config, saving storage costs, while the configuration itself can grow.
- **Batch Operations:** `bulkSetMaxUsd` allows efficient mass updates in a single transaction.

## 10. Testing

The contract has comprehensive test coverage:

- **Hardhat Tests:** 31 tests covering deployment, oracle signer, max USD, bulk operations, view functions, access control, and gas optimization
- **Foundry Fuzz Tests:** 23 property-based tests with randomized inputs
- **Echidna Invariant Tests:** 10 invariant properties for continuous verification

Run tests:
```bash
# Hardhat tests
yarn test test/GasXConfig.test.ts

# Foundry fuzz tests
forge test --match-contract GasXConfigFuzzTest

# Echidna (if available)
echidna test/echidna/GasXConfig.echidna.sol --contract GasXConfigEchidnaTest
```
