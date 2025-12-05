import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("GasXERC20FeePaymaster", function () {
  // Test constants
  const MIN_FEE = ethers.parseUnits("0.01", 6); // 0.01 USDC (6 decimals)
  const FEE_MARKUP_BPS = 100n; // 1%
  const MOCK_PRICE = ethers.parseUnits("2000", 6); // 1 ETH = 2000 USDC

  async function deployFixture() {
    const [owner, oracleSigner, user, treasury] = await ethers.getSigners();

    // Deploy EntryPoint mock (simplified)
    const EntryPointFactory = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPointFactory.deploy();

    // Deploy MockERC20 for fee token (USDC-like, 6 decimals)
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const feeToken = await MockERC20Factory.deploy("USD Coin", "USDC", 6);

    // Deploy MockERC20 for WETH (18 decimals)
    const weth = await MockERC20Factory.deploy("Wrapped Ether", "WETH", 18);

    // Deploy Mock Oracle that returns a fixed price
    const MockOracleFactory = await ethers.getContractFactory("MockOracle");
    const mockOracle = await MockOracleFactory.deploy(MOCK_PRICE);

    // Deploy MultiOracleAggregator
    const AggregatorFactory = await ethers.getContractFactory("MultiOracleAggregator");
    const aggregator = await AggregatorFactory.deploy(owner.address);

    // Register the mock oracle adapter
    // For simplicity, we'll use a mock that the aggregator can call
    // In production, you'd register proper adapters

    // Deploy the paymaster
    const PaymasterFactory = await ethers.getContractFactory("GasXERC20FeePaymaster");
    const paymaster = await PaymasterFactory.deploy(
      await entryPoint.getAddress(),
      await feeToken.getAddress(),
      await weth.getAddress(),
      await aggregator.getAddress(),
      oracleSigner.address,
      MIN_FEE,
      FEE_MARKUP_BPS,
    );

    // Fund the paymaster with ETH for gas sponsorship
    await owner.sendTransaction({
      to: await paymaster.getAddress(),
      value: ethers.parseEther("10"),
    });

    // Mint tokens to user
    await feeToken.mint(user.address, ethers.parseUnits("1000", 6));

    return {
      owner,
      oracleSigner,
      user,
      treasury,
      entryPoint,
      feeToken,
      weth,
      aggregator,
      mockOracle,
      paymaster,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct fee token", async function () {
      const { paymaster, feeToken } = await loadFixture(deployFixture);
      expect(await paymaster.feeToken()).to.equal(await feeToken.getAddress());
    });

    it("Should set the correct oracle signer", async function () {
      const { paymaster, oracleSigner } = await loadFixture(deployFixture);
      expect(await paymaster.oracleSigner()).to.equal(oracleSigner.address);
    });

    it("Should set the correct min fee", async function () {
      const { paymaster } = await loadFixture(deployFixture);
      expect(await paymaster.minFee()).to.equal(MIN_FEE);
    });

    it("Should set the correct fee markup", async function () {
      const { paymaster } = await loadFixture(deployFixture);
      expect(await paymaster.feeMarkupBps()).to.equal(FEE_MARKUP_BPS);
    });

    it("Should reject zero address for fee token", async function () {
      const { entryPoint, weth, aggregator, oracleSigner } = await loadFixture(deployFixture);
      const PaymasterFactory = await ethers.getContractFactory("GasXERC20FeePaymaster");

      await expect(
        PaymasterFactory.deploy(
          await entryPoint.getAddress(),
          ethers.ZeroAddress, // Invalid
          await weth.getAddress(),
          await aggregator.getAddress(),
          oracleSigner.address,
          MIN_FEE,
          FEE_MARKUP_BPS,
        ),
      ).to.be.revertedWith("GasX: Invalid feeToken address");
    });

    it("Should reject markup too high", async function () {
      const { entryPoint, feeToken, weth, aggregator, oracleSigner } = await loadFixture(deployFixture);
      const PaymasterFactory = await ethers.getContractFactory("GasXERC20FeePaymaster");

      await expect(
        PaymasterFactory.deploy(
          await entryPoint.getAddress(),
          await feeToken.getAddress(),
          await weth.getAddress(),
          await aggregator.getAddress(),
          oracleSigner.address,
          MIN_FEE,
          1001n, // > 10%, invalid
        ),
      ).to.be.revertedWith("GasX: Markup too high");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update oracle signer", async function () {
      const { paymaster, owner, user } = await loadFixture(deployFixture);

      await expect(paymaster.connect(owner).setOracleSigner(user.address))
        .to.emit(paymaster, "OracleSignerUpdated")
        .withArgs(user.address);

      expect(await paymaster.oracleSigner()).to.equal(user.address);
    });

    it("Should reject non-owner updating oracle signer", async function () {
      const { paymaster, user } = await loadFixture(deployFixture);

      await expect(paymaster.connect(user).setOracleSigner(user.address)).to.be.revertedWithCustomError(
        paymaster,
        "OwnableUnauthorizedAccount",
      );
    });

    it("Should allow owner to update min fee", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);
      const newMinFee = ethers.parseUnits("0.05", 6);

      await expect(paymaster.connect(owner).setMinFee(newMinFee))
        .to.emit(paymaster, "MinFeeUpdated")
        .withArgs(newMinFee);

      expect(await paymaster.minFee()).to.equal(newMinFee);
    });

    it("Should allow owner to update fee markup", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);
      const newMarkup = 200n; // 2%

      await expect(paymaster.connect(owner).setFeeMarkup(newMarkup))
        .to.emit(paymaster, "FeeMarkupUpdated")
        .withArgs(newMarkup);

      expect(await paymaster.feeMarkupBps()).to.equal(newMarkup);
    });

    it("Should reject fee markup over 10%", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);

      await expect(paymaster.connect(owner).setFeeMarkup(1001n)).to.be.revertedWith("GasX: Markup too high");
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow owner to pause", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);

      await paymaster.connect(owner).pause();
      expect(await paymaster.paused()).to.equal(true);
    });

    it("Should allow owner to unpause", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);

      await paymaster.connect(owner).pause();
      await paymaster.connect(owner).unpause();
      expect(await paymaster.paused()).to.equal(false);
    });

    it("Should reject non-owner pause", async function () {
      const { paymaster, user } = await loadFixture(deployFixture);

      await expect(paymaster.connect(user).pause()).to.be.revertedWithCustomError(
        paymaster,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("Fee Withdrawal", function () {
    it("Should allow owner to withdraw fees", async function () {
      const { paymaster, owner, treasury, feeToken, user } = await loadFixture(deployFixture);

      // Simulate fees collected by transferring tokens to paymaster
      const feeAmount = ethers.parseUnits("100", 6);
      await feeToken.connect(user).transfer(await paymaster.getAddress(), feeAmount);

      const balanceBefore = await feeToken.balanceOf(treasury.address);

      await expect(paymaster.connect(owner).withdrawFees(treasury.address, feeAmount))
        .to.emit(paymaster, "FeesWithdrawn")
        .withArgs(treasury.address, feeAmount);

      const balanceAfter = await feeToken.balanceOf(treasury.address);
      expect(balanceAfter - balanceBefore).to.equal(feeAmount);
    });

    it("Should allow withdrawing all fees with amount=0", async function () {
      const { paymaster, owner, treasury, feeToken, user } = await loadFixture(deployFixture);

      const feeAmount = ethers.parseUnits("100", 6);
      await feeToken.connect(user).transfer(await paymaster.getAddress(), feeAmount);

      await paymaster.connect(owner).withdrawFees(treasury.address, 0);

      expect(await feeToken.balanceOf(await paymaster.getAddress())).to.equal(0);
    });

    it("Should reject withdrawal to zero address", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);

      await expect(paymaster.connect(owner).withdrawFees(ethers.ZeroAddress, 100)).to.be.revertedWith(
        "GasX: Invalid recipient",
      );
    });

    it("Should reject non-owner withdrawal", async function () {
      const { paymaster, user, treasury } = await loadFixture(deployFixture);

      await expect(paymaster.connect(user).withdrawFees(treasury.address, 100)).to.be.revertedWithCustomError(
        paymaster,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("View Functions", function () {
    it("Should return fee balance", async function () {
      const { paymaster, feeToken, user } = await loadFixture(deployFixture);

      const amount = ethers.parseUnits("50", 6);
      await feeToken.connect(user).transfer(await paymaster.getAddress(), amount);

      expect(await paymaster.getFeeBalance()).to.equal(amount);
    });

    it("Should check user readiness - skipped without oracle setup", async function () {
      const { paymaster, user } = await loadFixture(deployFixture);

      // Note: checkUserReady calls estimateFee which requires oracle adapters
      // This test verifies the function exists and can be called
      const gasCost = ethers.parseEther("0.001");

      // The function should exist
      expect(paymaster.checkUserReady).to.be.a("function");

      // Calling it will fail due to oracle not configured, but that's expected
      await expect(paymaster.checkUserReady(user.address, gasCost)).to.be.reverted;
    });
  });

  describe("Token Recovery", function () {
    it("Should allow recovering stuck tokens", async function () {
      const { paymaster, owner, treasury, feeToken: token, user } = await loadFixture(deployFixture);

      // Send some tokens to paymaster
      const amount = ethers.parseUnits("10", 6);
      await token.connect(user).transfer(await paymaster.getAddress(), amount);

      // Recover them
      await paymaster.connect(owner).withdrawToken(await token.getAddress(), treasury.address, amount);

      expect(await token.balanceOf(treasury.address)).to.equal(amount);
    });
  });
});
