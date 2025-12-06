# GasX Smart Contracts

Enterprise-grade Account Abstraction infrastructure for gasless transactions on EVM chains.

## Overview

GasX provides a complete suite of smart contracts for:

- **Gasless Transactions** - Users interact with dApps without holding native tokens
- **Multi-Oracle Price Feeds** - Aggregated price data from DIA, Euler, and custom oracles
- **Subscription-based Gas Sponsorship** - Tiered plans with credit systems
- **ERC-20 Fee Payments** - Pay gas fees in stablecoins (USDC, DAI, USDT)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GasX Platform                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Paymasters    │  │    Oracles      │  │   Factories     │  │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤  │
│  │ GasXWhitelist   │  │ MultiOracle     │  │ Aggregator      │  │
│  │ GasXERC20Fee    │  │ DIAAdapter      │  │ DIAAdapter      │  │
│  │ GasXSubscript.  │  │ EulerAdapter    │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                    ERC-4337 EntryPoint                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Contracts

### Core Contracts

| Contract | Description | Network |
|----------|-------------|---------|
| `GasXWhitelistPaymaster` | Gasless tx for whitelisted addresses | Scroll, Arbitrum, Base |
| `GasXERC20FeePaymaster` | Pay gas in ERC-20 tokens | Scroll, Arbitrum, Base |
| `GasXSubscriptions` | Subscription-based gas sponsorship | Scroll Sepolia |
| `GasXConfig` | Protocol configuration | All |

### Oracle Infrastructure

| Contract | Description |
|----------|-------------|
| `MultiOracleAggregator` | Aggregates multiple oracle feeds with deviation checks |
| `DIAOracleAdapter` | Adapter for DIA Oracle V2 |
| `EulerOracleAdapter` | Adapter for Euler Price Oracle |
| `AggregatorFactory` | Deploys and manages aggregator instances |
| `DIAAdapterFactory` | Deploys DIA adapters |

### Account Abstraction

| Contract | Description |
|----------|-------------|
| `SimpleAccount` | ERC-4337 compatible smart account |
| `SimpleAccountFactory` | Counterfactual account deployment |

## Security

### Static Analysis

| Tool | Status | Findings |
|------|--------|----------|
| Slither | ✅ Pass | 0 Medium/High |
| Aderyn | ✅ Pass | 0 High, 14 Low (informational) |

### Test Coverage

```
------------------------------|----------|----------|----------|----------|
File                          |  % Stmts | % Branch |  % Funcs |  % Lines |
------------------------------|----------|----------|----------|----------|
All files                     |    96.17 |    84.34 |    93.10 |    97.04 |
------------------------------|----------|----------|----------|----------|
```

### Testing Suite

| Type | Framework | Count | Status |
|------|-----------|-------|--------|
| Unit Tests | Hardhat + Chai | 344 | ✅ Passing |
| Fuzz Tests | Foundry | 101 | ✅ Passing |
| Invariant Tests | Echidna | Configured | ✅ Ready |

## Development

### Prerequisites

- Node.js 18+
- Yarn or pnpm
- Foundry (for fuzz testing)

### Installation

```bash
yarn install
```

### Compile

```bash
yarn compile
```

### Test

```bash
# Unit tests
yarn test

# Coverage report
yarn coverage

# Fuzz tests (requires Foundry)
forge test --match-path "test/foundry/*.fuzz.t.sol"
```

### Security Analysis

```bash
# Slither
slither contracts/ --exclude-informational --exclude-low

# Aderyn
aderyn . -o report-aderyn.md
```

### Deploy

```bash
# Scroll Sepolia
yarn deploy --network scrollSepolia

# Arbitrum Sepolia
yarn deploy --network arbitrumSepolia
```

## Environment Variables

```env
# Required
DEPLOYER_PRIVATE_KEY=0x...
SCROLL_SEPOLIA_RPC_URL=https://...
ARBITRUM_SEPOLIA_RPC_URL=https://...

# Optional - Verification
SCROLLSCAN_API_KEY=...
ARBISCAN_API_KEY=...

# Optional - Oracles
DIA_ORACLE_ADDRESS=0x...
```

## Deployed Addresses

### Scroll Sepolia

| Contract | Address |
|----------|---------|
| EntryPoint | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| GasXWhitelistPaymaster | See deployments/ |
| GasXSubscriptions | See deployments/ |

### Arbitrum Sepolia

| Contract | Address |
|----------|---------|
| EntryPoint | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| GasXERC20FeePaymaster | See deployments/ |

## Audit Status

| Item | Status |
|------|--------|
| Internal Security Review | ✅ Complete |
| Static Analysis (Slither/Aderyn) | ✅ 0 High/Medium |
| Fuzz Testing | ✅ 101 tests passing |
| Invariant Testing | ✅ Configured |
| Formal Audit | 🔄 Pending |

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Ensure all tests pass
4. Submit a pull request

## Contact

- GitHub Issues: [Report a bug](https://github.com/edsphinx/builder-hub/issues)
- Security: security@gasx.io
