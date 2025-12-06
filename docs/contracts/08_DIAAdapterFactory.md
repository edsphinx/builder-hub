# Contract Reference: `DIAAdapterFactory.sol`

This document provides a detailed technical reference for the `DIAAdapterFactory` contract.

- **Source Code:** [`contracts/factories/DIAAdapterFactory.sol`](../../packages/hardhat/contracts/factories/DIAAdapterFactory.sol)
- **Type:** Factory Contract
- **Deploys:** `DIAOracleAdapter`

## 1. Overview

The `DIAAdapterFactory` is a factory contract that streamlines the deployment and registration of `DIAOracleAdapter` instances. It provides a single entry point for creating new adapters preconfigured with DIA oracle settings.

### Key Features
- **Simplified Deployment:** Deploy adapters with a single function call.
- **Preconfigured DIA Oracle:** All deployed adapters use the same DIA oracle contract.
- **Immutable Configuration:** Factory settings cannot be changed after deployment.

## 2. Core Logic (`deployAdapter`)

The `deployAdapter` function creates a new `DIAOracleAdapter` for a specific token pair.

1. **Validation:** Checks that base/quote addresses are non-zero and key is not empty.
2. **Deployment:** Creates a new `DIAOracleAdapter` with the configured DIA oracle.
3. **Event Emission:** Emits `AdapterCreated` with the new adapter address.
4. **Return:** Returns the address of the newly deployed adapter.

## 3. Constructor Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `_aggregator` | `address` | Address of the oracle aggregator (for reference) |
| `_diaOracle` | `address` | Address of the DIA Oracle V2 contract |

### Constructor Validations
- Reverts with `ZeroAddress()` if any address is zero.

## 4. Admin Functions (`onlyOwner`)

- **`deployAdapter(address base, address quote, string key)`:** Deploys a new `DIAOracleAdapter` for the specified token pair. Returns the adapter address. Emits `AdapterCreated`.

## 5. View Functions

- **`aggregator()`:** Returns the immutable aggregator contract address.
- **`dia()`:** Returns the immutable DIA oracle contract address.
- **`owner()`:** Returns the immutable owner address.

## 6. Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `AdapterCreated` | `address indexed adapter, address indexed base, address indexed quote, string key` | Emitted when a new adapter is deployed |

## 7. Custom Errors

| Error | Description |
|-------|-------------|
| `ZeroAddress()` | Thrown when a zero address is provided |
| `ZeroKey()` | Thrown when an empty key string is provided |

## 8. Usage Example

```solidity
// Deploy factory
DIAAdapterFactory factory = new DIAAdapterFactory(aggregator, diaOracle);

// Deploy adapter for ETH/USD pair
address adapter = factory.deployAdapter(
    0xWETH...,      // base token (WETH)
    0xUSDC...,      // quote token (USDC)
    "ETH/USD"       // DIA key
);

// Register adapter with aggregator (separate step)
aggregator.addOracle(base, quote, adapter);
```

## 9. Security Considerations

1. **Immutable Settings:** The DIA oracle and aggregator addresses cannot be changed.
2. **Owner Only:** Only the factory owner can deploy new adapters.
3. **Key Validation:** Empty keys are rejected to prevent misconfiguration.
4. **No Self-Registration:** The factory does not automatically register adapters; this must be done separately.
