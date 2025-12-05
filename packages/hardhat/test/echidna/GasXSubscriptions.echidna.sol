// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/core/GasXSubscriptions.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title GasXSubscriptions Echidna Property Tests
 * @notice Invariant testing using Echidna fuzzer
 * @dev Run with: echidna test/echidna/GasXSubscriptions.echidna.sol --contract GasXSubscriptionsEchidna --config echidna.yaml
 */
contract GasXSubscriptionsEchidna {
    GasXSubscriptions public implementation;
    GasXSubscriptions public subscriptions;
    MockERC20Echidna public usdc;

    address public treasury;
    address public user;

    uint256 constant MAX_CREDITS = 1_000_000_000; // 1 billion credits max
    uint256 constant MAX_PLANS = 100;
    uint256 constant MAX_PACKS = 100;

    constructor() {
        treasury = address(0x1111);
        user = address(0x2222);

        // Deploy mock USDC
        usdc = new MockERC20Echidna();

        // Deploy implementation
        implementation = new GasXSubscriptions();

        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(GasXSubscriptions.initialize.selector, treasury, address(usdc));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        subscriptions = GasXSubscriptions(payable(address(proxy)));

        // Mint USDC to user
        usdc.mint(user, 1_000_000_000_000); // 1M USDC
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INVARIANT: Credit balance can never exceed MAX_CREDITS
    // ═══════════════════════════════════════════════════════════════════════════

    function echidna_credits_bounded() public view returns (bool) {
        return subscriptions.getCreditBalance(user) <= MAX_CREDITS;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INVARIANT: Plan count should never exceed MAX_PLANS
    // ═══════════════════════════════════════════════════════════════════════════

    function echidna_plans_bounded() public view returns (bool) {
        return subscriptions.planCount() <= MAX_PLANS;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INVARIANT: Credit pack count should never exceed MAX_PACKS
    // ═══════════════════════════════════════════════════════════════════════════

    function echidna_packs_bounded() public view returns (bool) {
        return subscriptions.creditPackCount() <= MAX_PACKS;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INVARIANT: Treasury address should never be zero
    // ═══════════════════════════════════════════════════════════════════════════

    function echidna_treasury_not_zero() public view returns (bool) {
        return subscriptions.treasury() != address(0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INVARIANT: Platform fee should never exceed max
    // ═══════════════════════════════════════════════════════════════════════════

    function echidna_fee_capped() public view returns (bool) {
        uint256 planCount = subscriptions.planCount();
        for (uint256 i = 0; i < planCount; i++) {
            (, , , , uint256 feeBps, ) = subscriptions.plans(i);
            if (feeBps > subscriptions.MAX_PLATFORM_FEE_BPS()) {
                return false;
            }
        }
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INVARIANT: Contract should never hold excessive ETH (treasury should receive it)
    // ═══════════════════════════════════════════════════════════════════════════

    function echidna_no_stuck_eth() public view returns (bool) {
        // Contract may temporarily hold ETH during transactions,
        // but should never accumulate more than a reasonable amount
        return address(subscriptions).balance <= 10 ether;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INVARIANT: Subscription end time should be in the future or 0 (never subscribed)
    // ═══════════════════════════════════════════════════════════════════════════

    function echidna_subscription_valid_time() public view returns (bool) {
        (bool isActive, , uint256 endTime) = subscriptions.getSubscriptionStatus(user);
        // If active, end time must be > now
        // If not active, we don't care about end time (could be past or 0)
        if (isActive) {
            return endTime > block.timestamp;
        }
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE-CHANGING FUNCTIONS (for Echidna to call)
    // ═══════════════════════════════════════════════════════════════════════════

    function createPlan(
        string memory name,
        uint256 priceUsdc,
        uint256 priceEth,
        uint256 durationDays,
        uint256 feeBps
    ) public {
        // Bound inputs to prevent obvious failures
        if (bytes(name).length == 0) name = "test";
        if (durationDays == 0) durationDays = 30;
        if (feeBps > 500) feeBps = 500; // Max 5%

        try subscriptions.createPlan(name, priceUsdc, priceEth, durationDays, feeBps) {
            // Success
        } catch {
            // Expected to fail for various reasons
        }
    }

    function subscribe(uint256 planId, bool autoRenew) public {
        // Simulate user subscribing
        usdc.approve(address(subscriptions), type(uint256).max);

        try subscriptions.subscribe(planId, address(usdc), autoRenew) {
            // Success
        } catch {
            // Expected to fail for invalid plans
        }
    }

    function purchaseCredits(uint256 packId) public {
        usdc.approve(address(subscriptions), type(uint256).max);

        try subscriptions.purchaseCredits(packId, address(usdc)) {
            // Success
        } catch {
            // Expected to fail for invalid packs
        }
    }

    function useCredits(uint256 amount, string memory reason) public {
        try subscriptions.useCredits(user, amount, reason) {
            // Success
        } catch {
            // Expected to fail if insufficient credits
        }
    }
}

// Minimal ERC20 mock for Echidna
contract MockERC20Echidna {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function decimals() external pure returns (uint8) {
        return 6;
    }
}
