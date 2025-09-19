# Contract Reference: `AggregatorFactory.sol`

The `AggregatorFactory` is a contract responsible for deploying and managing `MultiOracleAggregator` instances for different asset pairs.

- **Source Code:** [`contracts/factories/AggregatorFactory.sol`](../../contracts/factories/AggregatorFactory.sol)
- **Type:** Factory

---
## 1. Core Concepts

- **Factory Pattern**: Provides a centralized and controlled method for deploying new oracle aggregators.
- **UUPS Proxies**: Each new aggregator is deployed as an upgradeable ERC1967 proxy, pointing to a single logic implementation. This is gas-efficient and allows for future upgrades.
- **Ownership Model**: The factory's owner initially controls all deployed aggregator instances, with the ability to transfer ownership later.
- **Event-Driven**: All significant actions (creation, removal, ownership transfer) emit detailed events for off-chain monitoring and indexing.

---
## 2. Constructor

```solidity
constructor(address _implementation)
```
- **`_implementation`**: The address of the `MultiOracleAggregator` logic contract that will be used as the blueprint for all new proxies.

---
## 3. Key Functions

### `createAggregator`
Deploys a new `MultiOracleAggregator` proxy for a `(base, quote)` pair, registers the initial set of oracles, and sets the maximum deviation. Reverts if an aggregator for the pair already exists.

### `quoteViaFactory`
A convenience function that provides a price quote by routing the request to the correct, underlying aggregator instance for a given token pair. It can fetch either the median or average price.

### Administrative Functions (`onlyOwner`)
- **`removeAggregator`**: Removes an aggregator from the factory's registry.
- **`transferAggregatorOwnership`**: Transfers ownership of a specific, factory-deployed aggregator instance to a new address.
- **`transferOwnership`**: Transfers ownership of the factory contract itself.

---
## 4. Example Interaction (Hardhat/ethers)

```typescript
const aggregatorFactory = await ethers.getContractAt(
  'AggregatorFactory',
  factoryAddress
);

// Step 1: Create a new aggregator instance for ETH/USDC
await aggregatorFactory.createAggregator(
  ethAddress,
  usdcAddress,
  [mockOracle1.address, mockOracle2.address],
  250 // Max deviation 2.5%
);

// Step 2: Get a price quote via the factory
const quote = await aggregatorFactory.quoteViaFactory(
  ethAddress,
  usdcAddress,
  ethers.parseUnits('1', 18),
  false // Use average price
);

console.log(`1 ETH is approximately ${ethers.formatUnits(quote, 6)} USDC`);
```

---
## 5. Events

| Event | Description |
| :--- | :--- |
| `AggregatorCreated` | Emitted when a new aggregator proxy is deployed. |
| `AggregatorRemoved` | Emitted when an aggregator is removed from the registry. |
| `AggregatorOwnershipTransferred` | Emitted when ownership of a specific aggregator instance is transferred. |
| `OwnershipTransferred` | Emitted when ownership of the factory contract itself is transferred. |
| `QuoteRequested` | Emitted each time `quoteViaFactory` is called, for analytics. |

---
## 6. Status & Notes

- The factory is fully integrated with the `MultiOracleAggregator` contract.
- It is a core component of the protocol's scalable, multi-chain oracle infrastructure.
- All aggregators are deployed as **ERC1967 proxies**, allowing their logic to be upgraded in the future by deploying a new implementation contract.
