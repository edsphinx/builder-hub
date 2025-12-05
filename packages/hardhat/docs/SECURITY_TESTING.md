# GasX Security Testing Documentation

## Overview

This document describes the comprehensive security testing infrastructure for GasX smart contracts, including static analysis, fuzz testing, and invariant testing.

## Testing Tools

### 1. Hardhat Unit Tests
- **Location:** `test/*.test.ts`
- **Command:** `yarn test`
- **Coverage:** `yarn test:coverage`

### 2. Slither Static Analysis
- **Version:** 0.11.3
- **Config:** `slither.config.json`
- **Command:** `yarn security:slither`
- **CI Integration:** Runs on every PR via GitHub Actions

### 3. Foundry Fuzz Testing
- **Version:** nightly
- **Location:** `test/foundry/*.sol`
- **Config:** `foundry.toml`
- **Commands:**
  - `yarn test:fuzz` - Standard fuzz testing (1000 runs)
  - `yarn test:fuzz:deep` - Deep fuzz testing (5000 runs)

### 4. Echidna Invariant Testing
- **Version:** 2.2.5
- **Location:** `test/echidna/*.sol`
- **Config:** `echidna.yaml`
- **Commands:**
  - `yarn test:echidna:quick` - Quick invariant testing (1000 limit)
  - `yarn test:echidna` - Full invariant testing (50000 limit)

---

## Fuzz Testing Details

### Foundry Fuzz Tests (`GasXSubscriptions.fuzz.t.sol`)

| Test Function | Description | Runs |
|--------------|-------------|------|
| `testFuzz_SubscribeWithPlanId` | Tests subscription with random plan IDs | 1000 |
| `testFuzz_SubscribeWithEth_Refund` | Tests ETH overpayment refunds | 1000 |
| `testFuzz_SubscribeWithEth_Insufficient` | Tests insufficient ETH handling | 1000 |
| `testFuzz_SubscriptionExtension` | Tests subscription time extension | 1000 |
| `testFuzz_PurchaseCreditsWithPackId` | Tests credit purchases with random pack IDs | 1000 |
| `testFuzz_CreditUsage` | Tests credit usage never exceeds balance | 1000 |
| `testFuzz_CreatePlanFeeCap` | Tests platform fee cap enforcement | 1000 |
| `testFuzz_OnlyOwnerCanAdmin` | Tests admin function access control | 1000 |
| `testFuzz_TokenDecimalConversion` | Tests decimal conversion with precision loss protection | 1000 |

### Echidna Invariant Tests (`GasXSubscriptions.echidna.sol`)

| Invariant | Property |
|-----------|----------|
| `echidna_credits_bounded` | Credit balance never exceeds MAX_CREDITS |
| `echidna_plans_bounded` | Plan count never exceeds MAX_PLANS |
| `echidna_packs_bounded` | Credit pack count never exceeds MAX_PACKS |
| `echidna_treasury_not_zero` | Treasury address is never zero |
| `echidna_fee_capped` | Platform fees never exceed MAX_PLATFORM_FEE_BPS |
| `echidna_no_stuck_eth` | Contract never holds excessive ETH |
| `echidna_subscription_valid_time` | Active subscriptions have future end times |

---

## CI/CD Integration

### Main CI Pipeline (`.github/workflows/ci.yml`)

```yaml
Jobs:
  - test: Hardhat unit tests + coverage
  - foundry-fuzz: Foundry fuzz tests (1000 runs)
  - slither: Static analysis with SARIF upload
```

### Security Fuzzing Pipeline (`.github/workflows/security-fuzzing.yml`)

```yaml
Triggers:
  - Weekly schedule (Sundays)
  - Manual dispatch
  - PRs touching contracts

Jobs:
  - foundry-deep-fuzz: 5000+ runs per test
  - echidna-invariants: 10000+ test limit
```

---

## Running Security Tests Locally

```bash
# Unit tests with coverage
yarn test:coverage

# Static analysis
yarn security:slither

# Fuzz testing
yarn test:fuzz           # Standard
yarn test:fuzz:deep      # Deep (5000 runs)

# Invariant testing
yarn test:echidna:quick  # Quick (1000 limit)
yarn test:echidna        # Full (50000 limit)

# Run all security checks
yarn test:coverage && yarn security:slither && yarn test:fuzz
```

---

## Dependencies

### npm packages
- `forge-std` - Foundry standard library
- `ds-test` - (auto-installed via postinstall)

### System tools
- Foundry (forge) - Install via `foundryup`
- Echidna - Install from GitHub releases
- Slither - Install via `pip install slither-analyzer`
- crytic-compile - Install via `pip install crytic-compile`

---

## Security Fixes Applied

### CEI Pattern (Checks-Effects-Interactions)
- `subscribeWithEth()` - State updated before ETH transfer
- `purchaseCreditsWithEth()` - State updated before ETH transfer

### Input Validation
- Explicit bounds checking for `planId` and `packId`
- `AmountTooSmall` error for precision loss protection

### Access Control
- All admin functions protected with `onlyOwner` modifier
- Two-step ownership transfer pattern
