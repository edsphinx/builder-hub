import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { GasXSubscriptions, MockERC20Decimals } from "../typechain-types";

describe("GasXSubscriptions", function () {
  // Skip on non-local networks
  before(function () {
    if (network.name !== "localhost" && network.name !== "hardhat") {
      console.log(`[INFO] Skipping GasXSubscriptions tests - designed for local networks only.`);
      this.skip();
    }
  });

  // Test constants
  const USDC_DECIMALS = 6;
  const DAI_DECIMALS = 18;
  const ONE_DAY = 86400;
  const THIRTY_DAYS = 30 * ONE_DAY;

  // Plan prices (from contract defaults)
  const PRO_PRICE_USDC = 99_000000n; // 99 USDC
  const PRO_PRICE_ETH = ethers.parseEther("0.04");

  // Credit pack prices
  const STARTER_PACK_PRICE = 10_000000n; // 10 USDC
  const STARTER_PACK_CREDITS = 100n;

  async function deployFixture() {
    const [owner, treasury, feeCollector, user1, user2] = await ethers.getSigners();

    // Deploy mock USDC
    const MockERC20Factory = await ethers.getContractFactory("MockERC20Decimals");
    const usdc = (await MockERC20Factory.deploy("USD Coin", "USDC", USDC_DECIMALS)) as MockERC20Decimals;
    await usdc.waitForDeployment();

    // Deploy mock USDT
    const usdt = (await MockERC20Factory.deploy("Tether USD", "USDT", USDC_DECIMALS)) as MockERC20Decimals;
    await usdt.waitForDeployment();

    // Deploy mock DAI (18 decimals)
    const dai = (await MockERC20Factory.deploy("Dai Stablecoin", "DAI", DAI_DECIMALS)) as MockERC20Decimals;
    await dai.waitForDeployment();

    // Deploy GasXSubscriptions as UUPS proxy
    const SubscriptionsFactory = await ethers.getContractFactory("GasXSubscriptions");
    const subscriptions = (await upgrades.deployProxy(
      SubscriptionsFactory,
      [treasury.address, await usdc.getAddress()],
      { kind: "uups" },
    )) as unknown as GasXSubscriptions;
    await subscriptions.waitForDeployment();

    // Mint tokens to users
    await usdc.mint(user1.address, ethers.parseUnits("10000", USDC_DECIMALS));
    await usdc.mint(user2.address, ethers.parseUnits("10000", USDC_DECIMALS));
    await usdt.mint(user1.address, ethers.parseUnits("10000", USDC_DECIMALS));
    await dai.mint(user1.address, ethers.parseUnits("10000", DAI_DECIMALS));

    // Fund user1 with ETH for ETH payments
    // (users already have ETH in hardhat)

    return {
      owner,
      treasury,
      feeCollector,
      user1,
      user2,
      usdc,
      usdt,
      dai,
      subscriptions,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPLOYMENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);
      expect(await subscriptions.owner()).to.equal(owner.address);
    });

    it("Should set the correct treasury", async function () {
      const { subscriptions, treasury } = await loadFixture(deployFixture);
      expect(await subscriptions.treasury()).to.equal(treasury.address);
    });

    it("Should set the correct fee collector (initially treasury)", async function () {
      const { subscriptions, treasury } = await loadFixture(deployFixture);
      expect(await subscriptions.feeCollector()).to.equal(treasury.address);
    });

    it("Should add USDC as supported token", async function () {
      const { subscriptions, usdc } = await loadFixture(deployFixture);
      expect(await subscriptions.supportedTokens(await usdc.getAddress())).to.equal(true);
    });

    it("Should set USDC decimals correctly", async function () {
      const { subscriptions, usdc } = await loadFixture(deployFixture);
      expect(await subscriptions.tokenDecimals(await usdc.getAddress())).to.equal(USDC_DECIMALS);
    });

    it("Should create default plans", async function () {
      const { subscriptions } = await loadFixture(deployFixture);
      expect(await subscriptions.planCount()).to.equal(5);

      // Check free plan (ID 0)
      const freePlan = await subscriptions.getPlan(0);
      expect(freePlan.name).to.equal("free");
      expect(freePlan.priceUsdc).to.equal(0);
      expect(freePlan.platformFeeBps).to.equal(500); // 5%

      // Check pro plan (ID 1)
      const proPlan = await subscriptions.getPlan(1);
      expect(proPlan.name).to.equal("pro");
      expect(proPlan.priceUsdc).to.equal(PRO_PRICE_USDC);
      expect(proPlan.platformFeeBps).to.equal(250); // 2.5%
    });

    it("Should create default credit packs", async function () {
      const { subscriptions } = await loadFixture(deployFixture);
      expect(await subscriptions.creditPackCount()).to.equal(4);

      // Check starter pack (ID 0)
      const starterPack = await subscriptions.getCreditPack(0);
      expect(starterPack.name).to.equal("Starter Pack");
      expect(starterPack.credits).to.equal(STARTER_PACK_CREDITS);
      expect(starterPack.priceUsdc).to.equal(STARTER_PACK_PRICE);
    });

    it("Should reject zero treasury address", async function () {
      const { usdc } = await loadFixture(deployFixture);
      const SubscriptionsFactory = await ethers.getContractFactory("GasXSubscriptions");

      await expect(
        upgrades.deployProxy(SubscriptionsFactory, [ethers.ZeroAddress, await usdc.getAddress()], { kind: "uups" }),
      ).to.be.revertedWithCustomError({ interface: SubscriptionsFactory.interface }, "ZeroAddress");
    });

    it("Should reject zero USDC address", async function () {
      const { treasury } = await loadFixture(deployFixture);
      const SubscriptionsFactory = await ethers.getContractFactory("GasXSubscriptions");

      await expect(
        upgrades.deployProxy(SubscriptionsFactory, [treasury.address, ethers.ZeroAddress], { kind: "uups" }),
      ).to.be.revertedWithCustomError({ interface: SubscriptionsFactory.interface }, "ZeroAddress");
    });

    it("Should not allow re-initialization", async function () {
      const { subscriptions, treasury, usdc } = await loadFixture(deployFixture);

      await expect(subscriptions.initialize(treasury.address, await usdc.getAddress())).to.be.revertedWithCustomError(
        subscriptions,
        "InvalidInitialization",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION TESTS - ERC20
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Subscriptions - ERC20 Payments", function () {
    it("Should allow subscribing to pro plan with USDC", async function () {
      const { subscriptions, usdc, user1, treasury } = await loadFixture(deployFixture);

      // Approve USDC
      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);

      const treasuryBalanceBefore = await usdc.balanceOf(treasury.address);

      // Subscribe to pro plan (ID 1)
      await expect(subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), false))
        .to.emit(subscriptions, "SubscriptionPurchased")
        .withArgs(
          user1.address,
          1,
          await usdc.getAddress(),
          PRO_PRICE_USDC,
          (t: bigint) => t > 0,
          (t: bigint) => t > 0,
        );

      // Check subscription status
      const [isActive, planId, endTime] = await subscriptions.getSubscriptionStatus(user1.address);
      expect(isActive).to.equal(true);
      expect(planId).to.equal(1);
      expect(endTime).to.be.gt(0);

      // Check treasury received payment (minus fee)
      const treasuryBalanceAfter = await usdc.balanceOf(treasury.address);
      expect(treasuryBalanceAfter).to.be.gt(treasuryBalanceBefore);
    });

    it("Should allow subscribing to free plan", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      // No approval needed for free plan
      await subscriptions.connect(user1).subscribe(0, await usdc.getAddress(), false);

      const [isActive, planId] = await subscriptions.getSubscriptionStatus(user1.address);
      expect(isActive).to.equal(true);
      expect(planId).to.equal(0);
    });

    it("Should extend subscription if already active", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      // First subscription
      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC * 2n);
      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), false);

      const [, , firstEndTime] = await subscriptions.getSubscriptionStatus(user1.address);

      // Second subscription should extend
      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), false);

      const [, , secondEndTime] = await subscriptions.getSubscriptionStatus(user1.address);

      // Second end time should be ~30 days after first end time
      expect(secondEndTime).to.be.gt(firstEndTime);
    });

    it("Should reject inactive plan", async function () {
      const { subscriptions, usdc, user1, owner } = await loadFixture(deployFixture);

      // Deactivate plan 1
      await subscriptions.connect(owner).updatePlan(1, PRO_PRICE_USDC, PRO_PRICE_ETH, 250, false);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);

      await expect(
        subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), false),
      ).to.be.revertedWithCustomError(subscriptions, "InvalidPlan");
    });

    it("Should reject unsupported token", async function () {
      const { subscriptions, dai, user1 } = await loadFixture(deployFixture);

      await dai.connect(user1).approve(await subscriptions.getAddress(), ethers.parseUnits("99", DAI_DECIMALS));

      await expect(
        subscriptions.connect(user1).subscribe(1, await dai.getAddress(), false),
      ).to.be.revertedWithCustomError(subscriptions, "UnsupportedToken");
    });

    it("Should collect platform fee correctly", async function () {
      const { subscriptions, usdc, user1, treasury, feeCollector, owner } = await loadFixture(deployFixture);

      // Set separate fee collector
      await subscriptions.connect(owner).setFeeCollector(feeCollector.address);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);

      const treasuryBefore = await usdc.balanceOf(treasury.address);
      const feeCollectorBefore = await usdc.balanceOf(feeCollector.address);

      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), false);

      const treasuryAfter = await usdc.balanceOf(treasury.address);
      const feeCollectorAfter = await usdc.balanceOf(feeCollector.address);

      // Pro plan has 2.5% fee (250 bps)
      const expectedFee = (PRO_PRICE_USDC * 250n) / 10000n;
      const expectedNet = PRO_PRICE_USDC - expectedFee;

      expect(treasuryAfter - treasuryBefore).to.equal(expectedNet);
      expect(feeCollectorAfter - feeCollectorBefore).to.equal(expectedFee);
    });

    it("Should set auto-renew flag correctly", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);
      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), true);

      const subscription = await subscriptions.subscriptions(user1.address);
      expect(subscription.autoRenew).to.equal(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION TESTS - ETH
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Subscriptions - ETH Payments", function () {
    it("Should allow subscribing with ETH", async function () {
      const { subscriptions, user1, treasury } = await loadFixture(deployFixture);

      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);

      await expect(subscriptions.connect(user1).subscribeWithEth(1, false, { value: PRO_PRICE_ETH })).to.emit(
        subscriptions,
        "SubscriptionPurchased",
      );

      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryBalanceAfter).to.be.gt(treasuryBalanceBefore);

      const [isActive, planId] = await subscriptions.getSubscriptionStatus(user1.address);
      expect(isActive).to.equal(true);
      expect(planId).to.equal(1);
    });

    it("Should refund excess ETH", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      const excessAmount = ethers.parseEther("0.1");
      const userBalanceBefore = await ethers.provider.getBalance(user1.address);

      const tx = await subscriptions.connect(user1).subscribeWithEth(1, false, {
        value: PRO_PRICE_ETH + excessAmount,
      });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const userBalanceAfter = await ethers.provider.getBalance(user1.address);

      // User should have paid PRO_PRICE_ETH + gas, not the excess
      const expectedBalance = userBalanceBefore - PRO_PRICE_ETH - gasUsed;
      expect(userBalanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
    });

    it("Should reject insufficient ETH payment", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      await expect(
        subscriptions.connect(user1).subscribeWithEth(1, false, { value: PRO_PRICE_ETH / 2n }),
      ).to.be.revertedWithCustomError(subscriptions, "InsufficientPayment");
    });

    it("Should reject plan without ETH price", async function () {
      const { subscriptions, user1, owner } = await loadFixture(deployFixture);

      // Create a plan without ETH price
      await subscriptions.connect(owner).createPlan("eth-less", 50_000000n, 0, 30, 100);
      const newPlanId = (await subscriptions.planCount()) - 1n;

      await expect(
        subscriptions.connect(user1).subscribeWithEth(newPlanId, false, { value: ethers.parseEther("0.1") }),
      ).to.be.revertedWithCustomError(subscriptions, "UnsupportedToken");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-RENEWAL TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Auto-Renewal", function () {
    it("Should cancel auto-renew", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);
      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), true);

      await expect(subscriptions.connect(user1).cancelAutoRenew()).to.emit(subscriptions, "SubscriptionCanceled");

      const subscription = await subscriptions.subscriptions(user1.address);
      expect(subscription.autoRenew).to.equal(false);
    });

    it("Should reject cancel for non-subscriber", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(user1).cancelAutoRenew()).to.be.revertedWithCustomError(
        subscriptions,
        "NoActiveSubscription",
      );
    });

    it("Should renew subscription for eligible user", async function () {
      const { subscriptions, usdc, user1, owner } = await loadFixture(deployFixture);

      // Subscribe with auto-renew
      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC * 10n);
      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), true);

      // Fast forward past subscription end
      await time.increase(THIRTY_DAYS + 1);

      // Renew
      await expect(subscriptions.connect(owner).renewSubscription(user1.address)).to.emit(
        subscriptions,
        "SubscriptionRenewed",
      );

      const [isActive] = await subscriptions.getSubscriptionStatus(user1.address);
      expect(isActive).to.equal(true);
    });

    it("Should reject renewal for non-subscriber", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      await expect(subscriptions.renewSubscription(user1.address)).to.be.revertedWithCustomError(
        subscriptions,
        "NoActiveSubscription",
      );
    });

    it("Should reject renewal when auto-renew is off", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);
      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), false);

      await time.increase(THIRTY_DAYS + 1);

      await expect(subscriptions.renewSubscription(user1.address)).to.be.revertedWithCustomError(
        subscriptions,
        "NoActiveSubscription",
      );
    });

    it("Should reject renewal when subscription not expired", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC * 2n);
      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), true);

      // Don't wait for expiry
      await expect(subscriptions.renewSubscription(user1.address)).to.be.revertedWithCustomError(
        subscriptions,
        "SubscriptionNotExpired",
      );
    });

    it("Should reject renewal for ETH subscriptions", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      await subscriptions.connect(user1).subscribeWithEth(1, true, { value: PRO_PRICE_ETH });

      await time.increase(THIRTY_DAYS + 1);

      await expect(subscriptions.renewSubscription(user1.address)).to.be.revertedWithCustomError(
        subscriptions,
        "UnsupportedToken",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDIT PURCHASE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Credit Purchases - ERC20", function () {
    it("Should purchase starter pack credits", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), STARTER_PACK_PRICE);

      await expect(subscriptions.connect(user1).purchaseCredits(0, await usdc.getAddress()))
        .to.emit(subscriptions, "CreditsPurchased")
        .withArgs(user1.address, 0, STARTER_PACK_CREDITS, await usdc.getAddress(), STARTER_PACK_PRICE);

      expect(await subscriptions.getCreditBalance(user1.address)).to.equal(STARTER_PACK_CREDITS);
    });

    it("Should include bonus credits", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      // Growth pack (ID 1) has 50 bonus credits
      const growthPack = await subscriptions.getCreditPack(1);
      await usdc.connect(user1).approve(await subscriptions.getAddress(), growthPack.priceUsdc);

      await subscriptions.connect(user1).purchaseCredits(1, await usdc.getAddress());

      expect(await subscriptions.getCreditBalance(user1.address)).to.equal(
        growthPack.credits + growthPack.bonusCredits,
      );
    });

    it("Should track total credits purchased", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), STARTER_PACK_PRICE * 2n);

      await subscriptions.connect(user1).purchaseCredits(0, await usdc.getAddress());
      await subscriptions.connect(user1).purchaseCredits(0, await usdc.getAddress());

      expect(await subscriptions.totalCreditsPurchased(user1.address)).to.equal(STARTER_PACK_CREDITS * 2n);
    });

    it("Should reject inactive credit pack", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      // Deactivate pack 0 by creating a new one and checking the old
      // Actually, there's no updateCreditPack, so we need a different approach
      // For now, we'll test with a non-existent pack
      await usdc.connect(user1).approve(await subscriptions.getAddress(), STARTER_PACK_PRICE);

      // Pack 99 doesn't exist, so it's inactive
      await expect(
        subscriptions.connect(user1).purchaseCredits(99, await usdc.getAddress()),
      ).to.be.revertedWithCustomError(subscriptions, "InvalidCreditPack");
    });

    it("Should reject unsupported token for credits", async function () {
      const { subscriptions, dai, user1 } = await loadFixture(deployFixture);

      await dai.connect(user1).approve(await subscriptions.getAddress(), ethers.parseUnits("10", DAI_DECIMALS));

      await expect(
        subscriptions.connect(user1).purchaseCredits(0, await dai.getAddress()),
      ).to.be.revertedWithCustomError(subscriptions, "UnsupportedToken");
    });
  });

  describe("Credit Purchases - ETH", function () {
    it("Should purchase credits with ETH", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      const starterPack = await subscriptions.getCreditPack(0);

      await expect(subscriptions.connect(user1).purchaseCreditsWithEth(0, { value: starterPack.priceEth })).to.emit(
        subscriptions,
        "CreditsPurchased",
      );

      expect(await subscriptions.getCreditBalance(user1.address)).to.equal(STARTER_PACK_CREDITS);
    });

    it("Should refund excess ETH for credits", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      const starterPack = await subscriptions.getCreditPack(0);
      const excess = ethers.parseEther("0.01");

      const userBalanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await subscriptions.connect(user1).purchaseCreditsWithEth(0, { value: starterPack.priceEth + excess });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const userBalanceAfter = await ethers.provider.getBalance(user1.address);

      // Should only pay pack price + gas
      expect(userBalanceBefore - userBalanceAfter).to.be.closeTo(
        starterPack.priceEth + gasUsed,
        ethers.parseEther("0.0001"),
      );
    });

    it("Should reject insufficient ETH for credits", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      const starterPack = await subscriptions.getCreditPack(0);

      await expect(
        subscriptions.connect(user1).purchaseCreditsWithEth(0, { value: starterPack.priceEth / 2n }),
      ).to.be.revertedWithCustomError(subscriptions, "InsufficientPayment");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDIT USAGE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Credit Usage", function () {
    it("Should allow owner to use credits", async function () {
      const { subscriptions, usdc, user1, owner } = await loadFixture(deployFixture);

      // Buy credits first
      await usdc.connect(user1).approve(await subscriptions.getAddress(), STARTER_PACK_PRICE);
      await subscriptions.connect(user1).purchaseCredits(0, await usdc.getAddress());

      // Use credits
      await expect(subscriptions.connect(owner).useCredits(user1.address, 50, "Gas sponsorship"))
        .to.emit(subscriptions, "CreditsUsed")
        .withArgs(user1.address, 50, "Gas sponsorship");

      expect(await subscriptions.getCreditBalance(user1.address)).to.equal(50);
      expect(await subscriptions.totalCreditsUsed(user1.address)).to.equal(50);
    });

    it("Should reject using more credits than balance", async function () {
      const { subscriptions, usdc, user1, owner } = await loadFixture(deployFixture);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), STARTER_PACK_PRICE);
      await subscriptions.connect(user1).purchaseCredits(0, await usdc.getAddress());

      await expect(
        subscriptions.connect(owner).useCredits(user1.address, STARTER_PACK_CREDITS + 1n, "Test"),
      ).to.be.revertedWithCustomError(subscriptions, "InsufficientCredits");
    });

    it("Should reject non-owner using credits", async function () {
      const { subscriptions, usdc, user1, user2 } = await loadFixture(deployFixture);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), STARTER_PACK_PRICE);
      await subscriptions.connect(user1).purchaseCredits(0, await usdc.getAddress());

      await expect(subscriptions.connect(user2).useCredits(user1.address, 50, "Test")).to.be.revertedWithCustomError(
        subscriptions,
        "Unauthorized",
      );
    });

    it("Should allow owner to refund credits", async function () {
      const { subscriptions, user1, owner } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).refundCredits(user1.address, 100))
        .to.emit(subscriptions, "CreditsRefunded")
        .withArgs(user1.address, 100);

      expect(await subscriptions.getCreditBalance(user1.address)).to.equal(100);
    });

    it("Should reject non-owner refunding credits", async function () {
      const { subscriptions, user1, user2 } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(user2).refundCredits(user1.address, 100)).to.be.revertedWithCustomError(
        subscriptions,
        "Unauthorized",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN FUNCTIONS TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Admin Functions - Plans", function () {
    it("Should create new plan", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).createPlan("premium", 199_000000n, ethers.parseEther("0.08"), 30, 200))
        .to.emit(subscriptions, "PlanCreated")
        .withArgs(5, "premium", 199_000000n);

      const plan = await subscriptions.getPlan(5);
      expect(plan.name).to.equal("premium");
      expect(plan.active).to.equal(true);
    });

    it("Should update existing plan", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      await subscriptions.connect(owner).updatePlan(1, 150_000000n, ethers.parseEther("0.06"), 200, true);

      const plan = await subscriptions.getPlan(1);
      expect(plan.priceUsdc).to.equal(150_000000n);
    });

    it("Should reject non-owner creating plan", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      await expect(
        subscriptions.connect(user1).createPlan("test", 100_000000n, ethers.parseEther("0.04"), 30, 100),
      ).to.be.revertedWithCustomError(subscriptions, "Unauthorized");
    });
  });

  describe("Admin Functions - Credit Packs", function () {
    it("Should create new credit pack", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      await expect(
        subscriptions.connect(owner).createCreditPack("Mega Pack", 10000, 3000, 500_000000n, ethers.parseEther("0.2")),
      )
        .to.emit(subscriptions, "CreditPackCreated")
        .withArgs(4, "Mega Pack", 10000, 500_000000n);
    });

    it("Should reject non-owner creating credit pack", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      await expect(
        subscriptions.connect(user1).createCreditPack("Test Pack", 100, 0, 10_000000n, ethers.parseEther("0.004")),
      ).to.be.revertedWithCustomError(subscriptions, "Unauthorized");
    });
  });

  describe("Admin Functions - Tokens", function () {
    it("Should add supported token", async function () {
      const { subscriptions, owner, dai } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).addSupportedToken(await dai.getAddress(), DAI_DECIMALS))
        .to.emit(subscriptions, "TokenAdded")
        .withArgs(await dai.getAddress(), DAI_DECIMALS);

      expect(await subscriptions.supportedTokens(await dai.getAddress())).to.equal(true);
    });

    it("Should remove supported token", async function () {
      const { subscriptions, owner, usdc } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).removeSupportedToken(await usdc.getAddress()))
        .to.emit(subscriptions, "TokenRemoved")
        .withArgs(await usdc.getAddress());

      expect(await subscriptions.supportedTokens(await usdc.getAddress())).to.equal(false);
    });

    it("Should reject adding zero address token", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).addSupportedToken(ethers.ZeroAddress, 6)).to.be.revertedWithCustomError(
        subscriptions,
        "ZeroAddress",
      );
    });

    it("Should reject non-owner adding token", async function () {
      const { subscriptions, user1, dai } = await loadFixture(deployFixture);

      await expect(
        subscriptions.connect(user1).addSupportedToken(await dai.getAddress(), DAI_DECIMALS),
      ).to.be.revertedWithCustomError(subscriptions, "Unauthorized");
    });
  });

  describe("Admin Functions - Treasury & Fee Collector", function () {
    it("Should update treasury", async function () {
      const { subscriptions, owner, user1 } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).setTreasury(user1.address))
        .to.emit(subscriptions, "TreasuryUpdated")
        .withArgs(user1.address);

      expect(await subscriptions.treasury()).to.equal(user1.address);
    });

    it("Should update fee collector", async function () {
      const { subscriptions, owner, feeCollector } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).setFeeCollector(feeCollector.address))
        .to.emit(subscriptions, "FeeCollectorUpdated")
        .withArgs(feeCollector.address);

      expect(await subscriptions.feeCollector()).to.equal(feeCollector.address);
    });

    it("Should reject zero address for treasury", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).setTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        subscriptions,
        "ZeroAddress",
      );
    });

    it("Should reject zero address for fee collector", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).setFeeCollector(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        subscriptions,
        "ZeroAddress",
      );
    });
  });

  describe("Admin Functions - Ownership (2-Step)", function () {
    it("Should initiate ownership transfer", async function () {
      const { subscriptions, owner, user1 } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).transferOwnership(user1.address))
        .to.emit(subscriptions, "OwnershipTransferStarted")
        .withArgs(owner.address, user1.address);

      expect(await subscriptions.pendingOwner()).to.equal(user1.address);
      // Owner not changed yet
      expect(await subscriptions.owner()).to.equal(owner.address);
    });

    it("Should complete ownership transfer when pending owner accepts", async function () {
      const { subscriptions, owner, user1 } = await loadFixture(deployFixture);

      // Initiate transfer
      await subscriptions.connect(owner).transferOwnership(user1.address);

      // Accept transfer
      await expect(subscriptions.connect(user1).acceptOwnership())
        .to.emit(subscriptions, "OwnershipTransferred")
        .withArgs(owner.address, user1.address);

      expect(await subscriptions.owner()).to.equal(user1.address);
      expect(await subscriptions.pendingOwner()).to.equal(ethers.ZeroAddress);
    });

    it("Should reject accept from non-pending owner", async function () {
      const { subscriptions, owner, user1, user2 } = await loadFixture(deployFixture);

      await subscriptions.connect(owner).transferOwnership(user1.address);

      await expect(subscriptions.connect(user2).acceptOwnership()).to.be.revertedWithCustomError(
        subscriptions,
        "Unauthorized",
      );
    });

    it("Should allow owner to cancel pending transfer", async function () {
      const { subscriptions, owner, user1 } = await loadFixture(deployFixture);

      await subscriptions.connect(owner).transferOwnership(user1.address);
      await subscriptions.connect(owner).cancelOwnershipTransfer();

      expect(await subscriptions.pendingOwner()).to.equal(ethers.ZeroAddress);
    });

    it("Should reject zero address for new owner", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(owner).transferOwnership(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        subscriptions,
        "ZeroAddress",
      );
    });

    it("Should reject non-owner transferring ownership", async function () {
      const { subscriptions, user1, user2 } = await loadFixture(deployFixture);

      await expect(subscriptions.connect(user1).transferOwnership(user2.address)).to.be.revertedWithCustomError(
        subscriptions,
        "Unauthorized",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW FUNCTIONS TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("View Functions", function () {
    it("Should return correct subscription status", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      // Before subscription
      const [isActiveBefore] = await subscriptions.getSubscriptionStatus(user1.address);
      expect(isActiveBefore).to.equal(false);

      // After subscription
      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);
      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), false);

      const [isActiveAfter, planId, endTime] = await subscriptions.getSubscriptionStatus(user1.address);
      expect(isActiveAfter).to.equal(true);
      expect(planId).to.equal(1);
      expect(endTime).to.be.gt(await time.latest());
    });

    it("Should return correct credit balance", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      expect(await subscriptions.getCreditBalance(user1.address)).to.equal(0);
    });

    it("Should return plan details", async function () {
      const { subscriptions } = await loadFixture(deployFixture);

      const plan = await subscriptions.getPlan(1);
      expect(plan.name).to.equal("pro");
      expect(plan.priceUsdc).to.equal(PRO_PRICE_USDC);
    });

    it("Should return credit pack details", async function () {
      const { subscriptions } = await loadFixture(deployFixture);

      const pack = await subscriptions.getCreditPack(0);
      expect(pack.name).to.equal("Starter Pack");
      expect(pack.credits).to.equal(STARTER_PACK_CREDITS);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN DECIMAL CONVERSION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Token Decimal Conversion", function () {
    it("Should handle tokens with different decimals", async function () {
      const { subscriptions, owner, dai, user1, treasury } = await loadFixture(deployFixture);

      // Add DAI (18 decimals) as supported
      await subscriptions.connect(owner).addSupportedToken(await dai.getAddress(), DAI_DECIMALS);

      // Approve more DAI (need to account for decimal conversion)
      // 99 USDC (6 decimals) = 99e6
      // Converted to 18 decimals = 99e18
      const expectedDaiAmount = ethers.parseUnits("99", DAI_DECIMALS);
      await dai.connect(user1).approve(await subscriptions.getAddress(), expectedDaiAmount);

      const treasuryBefore = await dai.balanceOf(treasury.address);

      await subscriptions.connect(user1).subscribe(1, await dai.getAddress(), false);

      const treasuryAfter = await dai.balanceOf(treasury.address);
      expect(treasuryAfter).to.be.gt(treasuryBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RECEIVE ETH TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Receive ETH", function () {
    it("Should accept direct ETH transfers", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      const contractBalanceBefore = await ethers.provider.getBalance(await subscriptions.getAddress());

      await user1.sendTransaction({
        to: await subscriptions.getAddress(),
        value: ethers.parseEther("1"),
      });

      const contractBalanceAfter = await ethers.provider.getBalance(await subscriptions.getAddress());
      expect(contractBalanceAfter - contractBalanceBefore).to.equal(ethers.parseEther("1"));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // UPGRADE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("UUPS Upgrade with Timelock", function () {
    const UPGRADE_TIMELOCK = 48 * 60 * 60; // 48 hours in seconds

    it("Should schedule upgrade and set correct ready time", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      // Deploy new implementation
      const SubscriptionsFactory = await ethers.getContractFactory("GasXSubscriptions");
      const newImpl = await SubscriptionsFactory.deploy();
      await newImpl.waitForDeployment();
      const newImplAddress = await newImpl.getAddress();

      const txTime = (await time.latest()) + 1;
      await time.setNextBlockTimestamp(txTime);

      // Schedule upgrade
      await expect(subscriptions.connect(owner).scheduleUpgrade(newImplAddress))
        .to.emit(subscriptions, "UpgradeScheduled")
        .withArgs(newImplAddress, txTime + UPGRADE_TIMELOCK);

      expect(await subscriptions.pendingUpgrade()).to.equal(newImplAddress);
      expect(await subscriptions.upgradeReadyTime()).to.equal(txTime + UPGRADE_TIMELOCK);
    });

    it("Should execute upgrade after timelock passes", async function () {
      const { subscriptions, owner, usdc, user1 } = await loadFixture(deployFixture);

      // First purchase a subscription to have some state
      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);
      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), false);

      // Deploy new implementation
      const SubscriptionsFactory = await ethers.getContractFactory("GasXSubscriptions");
      const newImpl = await SubscriptionsFactory.deploy();
      await newImpl.waitForDeployment();
      const newImplAddress = await newImpl.getAddress();

      // Schedule upgrade
      await subscriptions.connect(owner).scheduleUpgrade(newImplAddress);

      // Fast forward past timelock
      await time.increase(UPGRADE_TIMELOCK + 1);

      // Now upgrade should work
      await expect(subscriptions.connect(owner).upgradeToAndCall(newImplAddress, "0x"))
        .to.emit(subscriptions, "UpgradeExecuted")
        .withArgs(newImplAddress);

      // Verify state is preserved after upgrade
      const [isActive, planId] = await subscriptions.getSubscriptionStatus(user1.address);
      expect(isActive).to.equal(true);
      expect(planId).to.equal(1);

      // Pending upgrade should be cleared
      expect(await subscriptions.pendingUpgrade()).to.equal(ethers.ZeroAddress);
    });

    it("Should reject upgrade before timelock", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      const SubscriptionsFactory = await ethers.getContractFactory("GasXSubscriptions");
      const newImpl = await SubscriptionsFactory.deploy();
      await newImpl.waitForDeployment();
      const newImplAddress = await newImpl.getAddress();

      // Schedule upgrade
      await subscriptions.connect(owner).scheduleUpgrade(newImplAddress);

      // Try to upgrade immediately (should fail because timelock not passed)
      await expect(subscriptions.connect(owner).upgradeToAndCall(newImplAddress, "0x")).to.be.revertedWithCustomError(
        subscriptions,
        "UpgradeNotReady",
      );
    });

    it("Should reject upgrade without scheduling", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      const SubscriptionsFactory = await ethers.getContractFactory("GasXSubscriptions");
      const newImpl = await SubscriptionsFactory.deploy();
      await newImpl.waitForDeployment();

      // Try to upgrade without scheduling (should fail)
      await expect(
        subscriptions.connect(owner).upgradeToAndCall(await newImpl.getAddress(), "0x"),
      ).to.be.revertedWithCustomError(subscriptions, "InvalidUpgrade");
    });

    it("Should allow canceling scheduled upgrade", async function () {
      const { subscriptions, owner } = await loadFixture(deployFixture);

      const SubscriptionsFactory = await ethers.getContractFactory("GasXSubscriptions");
      const newImpl = await SubscriptionsFactory.deploy();
      await newImpl.waitForDeployment();
      const newImplAddress = await newImpl.getAddress();

      // Schedule and then cancel
      await subscriptions.connect(owner).scheduleUpgrade(newImplAddress);
      await expect(subscriptions.connect(owner).cancelUpgrade())
        .to.emit(subscriptions, "UpgradeCanceled")
        .withArgs(newImplAddress);

      expect(await subscriptions.pendingUpgrade()).to.equal(ethers.ZeroAddress);
    });

    it("Should reject non-owner scheduling upgrade", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      const SubscriptionsFactory = await ethers.getContractFactory("GasXSubscriptions", user1);
      const newImpl = await SubscriptionsFactory.deploy();
      await newImpl.waitForDeployment();

      await expect(
        subscriptions.connect(user1).scheduleUpgrade(await newImpl.getAddress()),
      ).to.be.revertedWithCustomError(subscriptions, "Unauthorized");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Edge Cases", function () {
    it("Should handle subscription expiry correctly", async function () {
      const { subscriptions, usdc, user1 } = await loadFixture(deployFixture);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);
      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), false);

      // Fast forward past expiry
      await time.increase(THIRTY_DAYS + 1);

      const [isActive] = await subscriptions.getSubscriptionStatus(user1.address);
      expect(isActive).to.equal(false);
    });

    it("Should accumulate fees per token", async function () {
      const { subscriptions, usdc, user1, user2 } = await loadFixture(deployFixture);

      await usdc.connect(user1).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);
      await usdc.connect(user2).approve(await subscriptions.getAddress(), PRO_PRICE_USDC);

      await subscriptions.connect(user1).subscribe(1, await usdc.getAddress(), false);
      await subscriptions.connect(user2).subscribe(1, await usdc.getAddress(), false);

      const accumulatedFees = await subscriptions.accumulatedFees(await usdc.getAddress());
      const expectedFeePerSub = (PRO_PRICE_USDC * 250n) / 10000n;
      expect(accumulatedFees).to.equal(expectedFeePerSub * 2n);
    });

    it("Should extend ETH subscription if already active", async function () {
      const { subscriptions, user1 } = await loadFixture(deployFixture);

      // First subscription with ETH
      await subscriptions.connect(user1).subscribeWithEth(1, false, { value: PRO_PRICE_ETH });

      const [, , firstEndTime] = await subscriptions.getSubscriptionStatus(user1.address);

      // Second subscription should extend from first end time
      await subscriptions.connect(user1).subscribeWithEth(1, false, { value: PRO_PRICE_ETH });

      const [, , secondEndTime] = await subscriptions.getSubscriptionStatus(user1.address);

      // Second end time should be ~30 days after first end time
      expect(secondEndTime).to.be.gt(firstEndTime);
      // Verify it's approximately 30 days later (within a small margin for block time)
      expect(secondEndTime - firstEndTime).to.be.closeTo(BigInt(THIRTY_DAYS), 10n);
    });

    it("Should handle tokens with less than 6 decimals", async function () {
      const { subscriptions, owner, user1, treasury } = await loadFixture(deployFixture);

      // Deploy a token with 2 decimals (like some obscure tokens)
      const MockERC20Factory = await ethers.getContractFactory("MockERC20Decimals");
      const lowDecimalToken = await MockERC20Factory.deploy("Low Decimal", "LOW", 2);
      await lowDecimalToken.waitForDeployment();

      // Add it as supported
      await subscriptions.connect(owner).addSupportedToken(await lowDecimalToken.getAddress(), 2);

      // Mint tokens to user (99 USDC with 6 decimals = 99e6, with 2 decimals = 99e2 = 9900)
      // The conversion formula: usdcAmount / (10 ** (6 - 2)) = usdcAmount / 10000
      // So 99e6 / 10000 = 9900
      const expectedAmount = PRO_PRICE_USDC / 10000n; // 9900
      await lowDecimalToken.mint(user1.address, expectedAmount * 10n); // Mint extra for safety

      await lowDecimalToken.connect(user1).approve(await subscriptions.getAddress(), expectedAmount);

      const treasuryBefore = await lowDecimalToken.balanceOf(treasury.address);

      await subscriptions.connect(user1).subscribe(1, await lowDecimalToken.getAddress(), false);

      const treasuryAfter = await lowDecimalToken.balanceOf(treasury.address);

      // Treasury should have received tokens (minus fee)
      expect(treasuryAfter).to.be.gt(treasuryBefore);

      const [isActive] = await subscriptions.getSubscriptionStatus(user1.address);
      expect(isActive).to.equal(true);
    });
  });
});
