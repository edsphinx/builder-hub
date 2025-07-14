# AggregatorFactory

The `AggregatorFactory` is responsible for deploying and managing `MultiOracleAggregator` instances per asset pair. Each `(base, quote)` token pair is assigned a dedicated aggregator contract, which aggregates multiple oracle sources using either **average** or **median** pricing logic with deviation checks.

---

## 🧱 Core Concepts

- **Factory-aggregator pattern**: Centralized deployment and routing of multiple oracle aggregators.
- **UUPS proxy**: Each aggregator is deployed as an upgradeable proxy (ERC1967).
- **Deviation control**: Each aggregator enforces a maximum deviation in BPS across oracle sources.
- **Event-driven**: All actions emit detailed events for offchain indexing or monitoring.
- **Ownership model**: The factory owner manages all aggregators and transfers.

---

## 🔧 Constructor

```solidity
constructor(address _implementation)
```

- **\_implementation**: Address of the logic contract (`MultiOracleAggregator`) used as the implementation target for proxies.
- Sets deployer as the factory owner.

---

## ⚙️ Public Methods

### ➕ `createAggregator`

```solidity
function createAggregator(
  address base,
  address quote,
  address[] calldata oracles,
  uint256 maxDeviationBps
) external onlyOwner returns (address)
```

Deploys a new `MultiOracleAggregator` instance as a proxy for the `(base, quote)` pair.

- Registers the oracle list.
- Sets the `maxDeviationBps`.
- Emits `AggregatorCreated`.

> Reverts if the aggregator already exists for `(base, quote)` or `(quote, base)`.

---

### ❌ `removeAggregator`

```solidity
function removeAggregator(address base, address quote) external onlyOwner
```

- Removes the registered aggregator from internal mapping.
- Emits `AggregatorRemoved`.

---

### 🔑 `transferAggregatorOwnership`

```solidity
function transferAggregatorOwnership(address base, address quote, address newOwner) external onlyOwner
```

Transfers the ownership of a deployed aggregator instance.

- Emits `AggregatorOwnershipTransferred`.

---

### 👁️ `getAggregator`

```solidity
function getAggregator(address base, address quote) external view returns (address)
```

Returns the address of the registered aggregator for the token pair.

---

### ✅ `existsAggregator`

```solidity
function existsAggregator(address base, address quote) external view returns (bool)
```

Returns `true` if an aggregator exists for the `(base, quote)` pair.

---

### 🔄 `transferOwnership`

```solidity
function transferOwnership(address newOwner) external onlyOwner
```

Transfers control of the factory contract to a new owner.

---

## 🔍 Quote Interface

### 📈 `quoteViaFactory`

```solidity
function quoteViaFactory(
  address base,
  address quote,
  uint256 inAmount,
  bool useMedian
) external returns (uint256 quoteAmount)
```

Queries the registered aggregator for a price quote.

- If `useMedian == true`, uses `getQuoteMedian`.
- Otherwise, uses `getQuoteAverage`.
- Emits `QuoteRequested` with metadata (caller, pair, amount, method).

> Will revert if aggregator is not found for the pair.

---

## 🧪 Example Interaction (Hardhat/ethers)

```ts
const aggregatorFactory = await ethers.getContractAt(
	'AggregatorFactory',
	factoryAddress
);

// Step 1: Create aggregator
await aggregatorFactory.createAggregator(
	ethAddress,
	usdcAddress,
	[mockOracle1.address, mockOracle2.address],
	250 // max deviation 2.5%
);

// Step 2: Query quote (average)
const quote = await aggregatorFactory.quoteViaFactory(
	ethAddress,
	usdcAddress,
	ethers.parseUnits('1', 18),
	false
);
console.log(`1 ETH ≈ ${quote} USDC`);
```

---

## 🧾 Events

| Event                                                   | Description                             |
| ------------------------------------------------------- | --------------------------------------- |
| `AggregatorCreated(base, quote, aggregator)`            | Emitted on aggregator deployment        |
| `AggregatorRemoved(base, quote)`                        | Emitted on removal                      |
| `AggregatorOwnershipTransferred(base, quote, newOwner)` | Ownership change of aggregator          |
| `MaxDeviationUpdated(base, quote, maxDeviationBps)`     | Emitted on deviation setting            |
| `OwnershipTransferred(previous, newOwner)`              | Factory ownership transfer              |
| `QuoteRequested(caller, base, quote, inAmount, method)` | Emitted every time a quote is requested |

---

## 🧰 Notes

- Aggregators are deployed as **ERC1967 proxies** to allow logic upgrades via the implementation address.
- The same `(base, quote)` pair cannot be deployed in reverse.
- Recommended to use `existsAggregator()` before calling `createAggregator` or `quoteViaFactory`.

---

## ✅ Status

- ✅ Fully integrated with `MultiOracleAggregator`
- ✅ Supports both `average` and `median` quoting methods
- ✅ Emits detailed events
- ✅ Compatible with `WalletFuel` and other oracle consumers

---

## 📌 Next Steps

- Add support for dynamic oracle rebalancing (future version)
- Expose `listAggregators()` for analytics (optional)
- Add ZK feed compatibility (future extension)
