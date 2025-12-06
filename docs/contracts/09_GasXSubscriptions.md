# Contract Reference: `GasXSubscriptions.sol`

This document provides a detailed technical reference for the `GasXSubscriptions` contract.

- **Source Code:** [`contracts/core/GasXSubscriptions.sol`](../../packages/hardhat/contracts/core/GasXSubscriptions.sol)
- **Type:** Payment & Subscription Management
- **Inherits:** `Initializable`, `UUPSUpgradeable`, `ReentrancyGuardUpgradeable`, `PausableUpgradeable`

## 1. Overview

The `GasXSubscriptions` contract manages subscription payments and credit purchases for the GasX platform. It supports multiple payment tokens (USDC, USDT, DAI) and ETH, providing a flexible payment infrastructure for gas sponsorship services.

### Key Features
- **Multi-Token Payments:** Accepts USDC, USDT, DAI, and native ETH.
- **Subscription Plans:** Tiered subscription system with configurable pricing.
- **Credit System:** Purchase credit packs with bonus credits.
- **Auto-Renewal:** Optional automatic subscription renewal via token approvals.
- **Platform Fees:** Configurable fee collection per plan.
- **UUPS Upgradeable:** Proxy pattern with 48-hour upgrade timelock.

### Security Features
- **2-Step Ownership Transfer:** Pending owner must accept ownership.
- **Max Fee Cap:** Platform fees capped at 10% (1000 bps).
- **Pausable:** Emergency pause functionality.
- **ReentrancyGuard:** Protection on all payment functions.
- **SafeERC20:** Safe token transfer handling.

## 2. Data Structures

### Plan
```solidity
struct Plan {
    string name;           // "free", "pro", "enterprise"
    uint256 priceUsdc;     // Price in USDC (6 decimals)
    uint256 priceEth;      // Alternative price in ETH (wei)
    uint256 durationDays;  // 30 for monthly, 365 for yearly
    uint256 platformFeeBps; // Fee in basis points (500 = 5%)
    bool active;
}
```

### CreditPack
```solidity
struct CreditPack {
    string name;
    uint256 credits;       // Number of credits
    uint256 bonusCredits;  // Bonus credits included
    uint256 priceUsdc;     // Price in USDC (6 decimals)
    uint256 priceEth;      // Alternative price in ETH (wei)
    bool active;
}
```

### Subscription
```solidity
struct Subscription {
    uint256 planId;
    uint256 startTime;
    uint256 endTime;
    address paymentToken;  // address(0) for ETH
    bool autoRenew;
}
```

## 3. Constants

| Name | Value | Description |
|------|-------|-------------|
| `MAX_PLATFORM_FEE_BPS` | 1000 | Maximum platform fee (10%) |
| `VERSION` | "1.0.0" | Contract version |
| `UPGRADE_TIMELOCK` | 48 hours | Delay before upgrades can be executed |

## 4. Admin Functions (`onlyOwner`)

### Plan Management
- **`createPlan(string name, uint256 priceUsdc, uint256 priceEth, uint256 durationDays, uint256 platformFeeBps)`:** Creates a new subscription plan. Emits `PlanCreated`.
- **`updatePlan(uint256 planId, uint256 priceUsdc, uint256 priceEth, bool active)`:** Updates an existing plan. Emits `PlanUpdated`.

### Credit Pack Management
- **`createCreditPack(string name, uint256 credits, uint256 bonusCredits, uint256 priceUsdc, uint256 priceEth)`:** Creates a new credit pack. Emits `CreditPackCreated`.
- **`updateCreditPack(uint256 packId, uint256 priceUsdc, uint256 priceEth, bool active)`:** Updates an existing credit pack.

### Token Management
- **`addSupportedToken(address token, uint8 decimals)`:** Adds a payment token.
- **`removeSupportedToken(address token)`:** Removes a payment token.

### Fee Management
- **`setFeeCollector(address collector)`:** Sets the fee collector address.
- **`withdrawFees(address token)`:** Withdraws accumulated platform fees.

### Emergency Functions
- **`pause()`:** Pauses the contract. Emits `Paused`.
- **`unpause()`:** Unpauses the contract. Emits `Unpaused`.
- **`emergencyWithdrawToken(address token, uint256 amount)`:** Emergency token withdrawal.
- **`emergencyWithdrawEth(uint256 amount)`:** Emergency ETH withdrawal.

### Ownership
- **`transferOwnership(address newOwner)`:** Initiates ownership transfer.
- **`acceptOwnership()`:** Accepts pending ownership (called by new owner).
- **`cancelOwnershipTransfer()`:** Cancels pending transfer.

## 5. User Functions

### Subscriptions
- **`subscribeWithToken(uint256 planId, address token, bool autoRenew)`:** Subscribe using ERC-20 token.
- **`subscribeWithEth(uint256 planId, bool autoRenew)`:** Subscribe using ETH. Emits `SubscriptionPurchased`.
- **`renewSubscription()`:** Manually renew current subscription. Emits `SubscriptionRenewed`.
- **`cancelAutoRenewal()`:** Disable auto-renewal. Emits `SubscriptionCanceled`.

### Credits
- **`purchaseCreditsWithToken(uint256 packId, address token)`:** Buy credits with ERC-20.
- **`purchaseCreditsWithEth(uint256 packId)`:** Buy credits with ETH. Emits `CreditsPurchased`.

## 6. View Functions

- **`plans(uint256 planId)`:** Returns plan details.
- **`creditPacks(uint256 packId)`:** Returns credit pack details.
- **`subscriptions(address user)`:** Returns user's subscription.
- **`creditBalances(address user)`:** Returns user's credit balance.
- **`isSubscriptionActive(address user)`:** Checks if subscription is active.
- **`supportedTokens(address token)`:** Checks if token is supported.

## 7. Events

| Event | Description |
|-------|-------------|
| `PlanCreated` | New subscription plan created |
| `PlanUpdated` | Existing plan updated |
| `CreditPackCreated` | New credit pack created |
| `SubscriptionPurchased` | User subscribed to a plan |
| `SubscriptionRenewed` | Subscription renewed |
| `SubscriptionCanceled` | Auto-renewal disabled |
| `CreditsPurchased` | Credits purchased |
| `CreditsUsed` | Credits consumed |
| `FeesWithdrawn` | Platform fees withdrawn |
| `OwnershipTransferStarted` | Ownership transfer initiated |
| `OwnershipTransferred` | Ownership transfer completed |

## 8. Security Considerations

1. **CEI Pattern:** All state changes occur before external calls.
2. **Reentrancy Protection:** `nonReentrant` modifier on all payment functions.
3. **Fee Cap:** Platform fees cannot exceed 10%.
4. **Upgrade Timelock:** 48-hour delay protects against malicious upgrades.
5. **2-Step Ownership:** Prevents accidental ownership transfers.
6. **Pausable:** Contract can be paused in emergencies.
