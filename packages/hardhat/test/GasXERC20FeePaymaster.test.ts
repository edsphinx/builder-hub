import { ethers, upgrades, network } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  GasXERC20FeePaymaster,
  TestableGasXERC20,
  MockERC20Decimals,
  MultiOracleAggregator,
  MockOracle,
  EntryPoint,
} from "../typechain-types";

describe("GasXERC20FeePaymaster", function () {
  // Skip on non-local networks - this test deploys mock contracts
  before(function () {
    if (network.name !== "localhost" && network.name !== "hardhat") {
      console.log(`[INFO] Skipping GasXERC20FeePaymaster tests - designed for local networks only.`);
      this.skip();
    }
  });
  // Test constants
  const MIN_FEE = ethers.parseUnits("0.01", 6); // 0.01 USDC (6 decimals)
  const FEE_MARKUP_BPS = 100n; // 1%
  // Price should reflect USDC decimals: 1 ETH = 2000 USDC
  // Since MockOracle returns (amount * price) / 1e18, and USDC has 6 decimals:
  // For 1e18 input (1 ETH), we want 2000e6 output (2000 USDC)
  // So price = 2000e6 (to get correct USDC-scaled output)
  const MOCK_PRICE = ethers.parseUnits("2000", 6); // 1 ETH = 2000 USDC with 6 decimals

  async function deployFixture() {
    const [owner, oracleSigner, user, treasury] = await ethers.getSigners();

    // Deploy EntryPoint from account-abstraction
    const EntryPointFactory = await ethers.getContractFactory(
      "@account-abstraction/contracts/core/EntryPoint.sol:EntryPoint",
    );
    const entryPoint = (await EntryPointFactory.deploy()) as EntryPoint;
    await entryPoint.waitForDeployment();

    // Deploy MockERC20Decimals for fee token (USDC-like, 6 decimals)
    const MockERC20Factory = await ethers.getContractFactory("MockERC20Decimals");
    const feeToken = (await MockERC20Factory.deploy("USD Coin", "USDC", 6)) as MockERC20Decimals;
    await feeToken.waitForDeployment();

    // Deploy MockERC20Decimals for WETH (18 decimals)
    const weth = (await MockERC20Factory.deploy("Wrapped Ether", "WETH", 18)) as MockERC20Decimals;
    await weth.waitForDeployment();

    // Deploy MockOracle that returns a fixed price
    const MockOracleFactory = await ethers.getContractFactory("MockOracle");
    const mockOracle = (await MockOracleFactory.deploy(MOCK_PRICE)) as MockOracle;
    await mockOracle.waitForDeployment();

    // Deploy MultiOracleAggregator as UUPS proxy
    const AggregatorFactory = await ethers.getContractFactory("MultiOracleAggregator");
    const aggregator = (await upgrades.deployProxy(AggregatorFactory, [owner.address, 500], {
      kind: "uups",
    })) as unknown as MultiOracleAggregator;
    await aggregator.waitForDeployment();

    // Register the mock oracle for WETH -> USDC pair
    await aggregator.addOracle(await weth.getAddress(), await feeToken.getAddress(), await mockOracle.getAddress());

    // Deploy the paymaster
    const PaymasterFactory = await ethers.getContractFactory("GasXERC20FeePaymaster");
    const paymaster = (await PaymasterFactory.deploy(
      await entryPoint.getAddress(),
      await feeToken.getAddress(),
      await weth.getAddress(),
      await aggregator.getAddress(),
      oracleSigner.address,
      MIN_FEE,
      FEE_MARKUP_BPS,
    )) as GasXERC20FeePaymaster;
    await paymaster.waitForDeployment();

    // Fund the paymaster with ETH for gas sponsorship (stake + deposit)
    await paymaster.addStake(86400, { value: ethers.parseEther("1") });
    await paymaster.deposit({ value: ethers.parseEther("5") });

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

    it("Should set the correct price oracle", async function () {
      const { paymaster, aggregator } = await loadFixture(deployFixture);
      expect(await paymaster.priceOracle()).to.equal(await aggregator.getAddress());
    });

    it("Should reject zero address for fee token", async function () {
      const { entryPoint, weth, aggregator, oracleSigner } = await loadFixture(deployFixture);
      const PaymasterFactory = await ethers.getContractFactory("GasXERC20FeePaymaster");

      await expect(
        PaymasterFactory.deploy(
          await entryPoint.getAddress(),
          ethers.ZeroAddress,
          await weth.getAddress(),
          await aggregator.getAddress(),
          oracleSigner.address,
          MIN_FEE,
          FEE_MARKUP_BPS,
        ),
      ).to.be.revertedWith("GasX: Invalid feeToken address");
    });

    it("Should reject zero address for priceQuoteBaseToken", async function () {
      const { entryPoint, feeToken, aggregator, oracleSigner } = await loadFixture(deployFixture);
      const PaymasterFactory = await ethers.getContractFactory("GasXERC20FeePaymaster");

      await expect(
        PaymasterFactory.deploy(
          await entryPoint.getAddress(),
          await feeToken.getAddress(),
          ethers.ZeroAddress,
          await aggregator.getAddress(),
          oracleSigner.address,
          MIN_FEE,
          FEE_MARKUP_BPS,
        ),
      ).to.be.revertedWith("GasX: Invalid priceQuoteBaseToken address");
    });

    it("Should reject zero address for price oracle", async function () {
      const { entryPoint, feeToken, weth, oracleSigner } = await loadFixture(deployFixture);
      const PaymasterFactory = await ethers.getContractFactory("GasXERC20FeePaymaster");

      await expect(
        PaymasterFactory.deploy(
          await entryPoint.getAddress(),
          await feeToken.getAddress(),
          await weth.getAddress(),
          ethers.ZeroAddress,
          oracleSigner.address,
          MIN_FEE,
          FEE_MARKUP_BPS,
        ),
      ).to.be.revertedWith("GasX: Invalid priceOracle address");
    });

    it("Should reject zero address for oracle signer", async function () {
      const { entryPoint, feeToken, weth, aggregator } = await loadFixture(deployFixture);
      const PaymasterFactory = await ethers.getContractFactory("GasXERC20FeePaymaster");

      await expect(
        PaymasterFactory.deploy(
          await entryPoint.getAddress(),
          await feeToken.getAddress(),
          await weth.getAddress(),
          await aggregator.getAddress(),
          ethers.ZeroAddress,
          MIN_FEE,
          FEE_MARKUP_BPS,
        ),
      ).to.be.revertedWith("GasX: Invalid initialOracleSigner address");
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
      const { paymaster, owner, user, oracleSigner } = await loadFixture(deployFixture);

      await expect(paymaster.connect(owner).setOracleSigner(user.address))
        .to.emit(paymaster, "OracleSignerUpdated")
        .withArgs(oracleSigner.address, user.address);

      expect(await paymaster.oracleSigner()).to.equal(user.address);
    });

    it("Should reject zero address for oracle signer update", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);

      await expect(paymaster.connect(owner).setOracleSigner(ethers.ZeroAddress)).to.be.revertedWith(
        "GasX: Invalid signer address",
      );
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
      const oldMinFee = await paymaster.minFee();
      const newMinFee = ethers.parseUnits("0.05", 6);

      await expect(paymaster.connect(owner).setMinFee(newMinFee))
        .to.emit(paymaster, "MinFeeUpdated")
        .withArgs(oldMinFee, newMinFee);

      expect(await paymaster.minFee()).to.equal(newMinFee);
    });

    it("Should reject non-owner updating min fee", async function () {
      const { paymaster, user } = await loadFixture(deployFixture);

      await expect(paymaster.connect(user).setMinFee(100n)).to.be.revertedWithCustomError(
        paymaster,
        "OwnableUnauthorizedAccount",
      );
    });

    it("Should allow owner to update fee markup", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);
      const oldMarkup = await paymaster.feeMarkupBps();
      const newMarkup = 200n; // 2%

      await expect(paymaster.connect(owner).setFeeMarkup(newMarkup))
        .to.emit(paymaster, "FeeMarkupUpdated")
        .withArgs(oldMarkup, newMarkup);

      expect(await paymaster.feeMarkupBps()).to.equal(newMarkup);
    });

    it("Should reject fee markup over 10%", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);

      await expect(paymaster.connect(owner).setFeeMarkup(1001n)).to.be.revertedWith("GasX: Markup too high");
    });

    it("Should reject non-owner updating fee markup", async function () {
      const { paymaster, user } = await loadFixture(deployFixture);

      await expect(paymaster.connect(user).setFeeMarkup(200n)).to.be.revertedWithCustomError(
        paymaster,
        "OwnableUnauthorizedAccount",
      );
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

    it("Should reject non-owner unpause", async function () {
      const { paymaster, owner, user } = await loadFixture(deployFixture);

      await paymaster.connect(owner).pause();
      await expect(paymaster.connect(user).unpause()).to.be.revertedWithCustomError(
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

    it("Should reject withdrawal exceeding balance", async function () {
      const { paymaster, owner, treasury } = await loadFixture(deployFixture);

      await expect(
        paymaster.connect(owner).withdrawFees(treasury.address, ethers.parseUnits("1000000", 6)),
      ).to.be.revertedWith("GasX: Insufficient balance");
    });

    it("Should reject non-owner withdrawal", async function () {
      const { paymaster, user, treasury } = await loadFixture(deployFixture);

      await expect(paymaster.connect(user).withdrawFees(treasury.address, 100)).to.be.revertedWithCustomError(
        paymaster,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("Token Recovery", function () {
    it("Should allow recovering stuck tokens (non-fee token)", async function () {
      const { paymaster, owner, treasury } = await loadFixture(deployFixture);

      // Mint some WETH (non-fee token) to paymaster
      const MockERC20Factory = await ethers.getContractFactory("MockERC20Decimals");
      const otherToken = await MockERC20Factory.deploy("Other Token", "OTHER", 18);
      await otherToken.waitForDeployment();

      const amount = ethers.parseEther("1");
      await otherToken.mint(await paymaster.getAddress(), amount);

      // Recover them
      await expect(paymaster.connect(owner).withdrawToken(await otherToken.getAddress(), treasury.address, amount))
        .to.emit(paymaster, "TokenRecovered")
        .withArgs(await otherToken.getAddress(), treasury.address, amount);

      expect(await otherToken.balanceOf(treasury.address)).to.equal(amount);
    });

    it("Should reject recovering fee token via withdrawToken", async function () {
      const { paymaster, owner, treasury, feeToken, user } = await loadFixture(deployFixture);

      // Send some fee tokens to paymaster
      const amount = ethers.parseUnits("10", 6);
      await feeToken.connect(user).transfer(await paymaster.getAddress(), amount);

      // Attempt to recover fee token via withdrawToken should fail
      await expect(
        paymaster.connect(owner).withdrawToken(await feeToken.getAddress(), treasury.address, amount),
      ).to.be.revertedWith("GasX: Use withdrawFees for fee token");
    });

    it("Should reject token recovery to zero address", async function () {
      const { paymaster, owner, weth } = await loadFixture(deployFixture);

      await expect(
        paymaster.connect(owner).withdrawToken(await weth.getAddress(), ethers.ZeroAddress, 100),
      ).to.be.revertedWith("GasX: Invalid recipient");
    });

    it("Should reject non-owner token recovery", async function () {
      const { paymaster, user, treasury, weth } = await loadFixture(deployFixture);

      await expect(
        paymaster.connect(user).withdrawToken(await weth.getAddress(), treasury.address, 100),
      ).to.be.revertedWithCustomError(paymaster, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    it("Should return fee balance", async function () {
      const { paymaster, feeToken, user } = await loadFixture(deployFixture);

      const amount = ethers.parseUnits("50", 6);
      await feeToken.connect(user).transfer(await paymaster.getAddress(), amount);

      expect(await paymaster.getFeeBalance()).to.equal(amount);
    });

    it("Should estimate fee correctly", async function () {
      const { paymaster } = await loadFixture(deployFixture);

      // Gas cost of 100000 wei
      const gasCost = 100000n;
      const estimatedFee = await paymaster.estimateFee(gasCost);

      // Fee should be at least minFee
      expect(estimatedFee).to.be.gte(MIN_FEE);
    });

    it("Should check user readiness", async function () {
      const { paymaster, user, feeToken } = await loadFixture(deployFixture);

      const gasCost = ethers.parseEther("0.001");

      // Check user balance first
      const userBalance = await feeToken.balanceOf(user.address);
      expect(userBalance).to.equal(ethers.parseUnits("1000", 6));

      // User has balance but no allowance
      const [hasAllowance, hasBalance, requiredAmount] = await paymaster.checkUserReady(user.address, gasCost);

      // requiredAmount should be > 0 since gasCost > 0 and price oracle returns a valid price
      expect(requiredAmount).to.be.gt(0n);
      expect(hasAllowance).to.equal(false);
      // User has 1000 USDC which should be more than the required fee
      expect(hasBalance).to.equal(true);
    });

    it("Should return correct readiness after approval", async function () {
      const { paymaster, user, feeToken } = await loadFixture(deployFixture);

      const gasCost = ethers.parseEther("0.001");

      // Approve paymaster
      await feeToken.connect(user).approve(await paymaster.getAddress(), ethers.parseUnits("1000", 6));

      const [hasAllowance, hasBalance] = await paymaster.checkUserReady(user.address, gasCost);

      expect(hasAllowance).to.equal(true);
      expect(hasBalance).to.equal(true);
    });
  });

  describe("Fee Tracking", function () {
    it("Should start with zero fees collected", async function () {
      const { paymaster } = await loadFixture(deployFixture);

      expect(await paymaster.totalFeesCollected()).to.equal(0n);
    });
  });

  // Testable fixture for validation and postOp tests
  async function deployTestableFixture() {
    const [owner, oracleSigner, user, treasury] = await ethers.getSigners();

    // Deploy EntryPoint from account-abstraction
    const EntryPointFactory = await ethers.getContractFactory(
      "@account-abstraction/contracts/core/EntryPoint.sol:EntryPoint",
    );
    const entryPoint = (await EntryPointFactory.deploy()) as EntryPoint;
    await entryPoint.waitForDeployment();

    // Deploy MockERC20Decimals for fee token (USDC-like, 6 decimals)
    const MockERC20Factory = await ethers.getContractFactory("MockERC20Decimals");
    const feeToken = (await MockERC20Factory.deploy("USD Coin", "USDC", 6)) as MockERC20Decimals;
    await feeToken.waitForDeployment();

    // Deploy MockERC20Decimals for WETH (18 decimals)
    const weth = (await MockERC20Factory.deploy("Wrapped Ether", "WETH", 18)) as MockERC20Decimals;
    await weth.waitForDeployment();

    // Deploy MockOracle that returns a fixed price
    const MockOracleFactory = await ethers.getContractFactory("MockOracle");
    const mockOracle = (await MockOracleFactory.deploy(MOCK_PRICE)) as MockOracle;
    await mockOracle.waitForDeployment();

    // Deploy MultiOracleAggregator as UUPS proxy
    const AggregatorFactory = await ethers.getContractFactory("MultiOracleAggregator");
    const aggregator = (await upgrades.deployProxy(AggregatorFactory, [owner.address, 500], {
      kind: "uups",
    })) as unknown as MultiOracleAggregator;
    await aggregator.waitForDeployment();

    // Register the mock oracle for WETH -> USDC pair
    await aggregator.addOracle(await weth.getAddress(), await feeToken.getAddress(), await mockOracle.getAddress());

    // Deploy the testable paymaster
    const TestableFactory = await ethers.getContractFactory("TestableGasXERC20");
    const paymaster = (await TestableFactory.deploy(
      await entryPoint.getAddress(),
      await feeToken.getAddress(),
      await weth.getAddress(),
      await aggregator.getAddress(),
      oracleSigner.address,
      MIN_FEE,
      FEE_MARKUP_BPS,
    )) as TestableGasXERC20;
    await paymaster.waitForDeployment();

    // Fund the paymaster with ETH for gas sponsorship (stake + deposit)
    await paymaster.addStake(86400, { value: ethers.parseEther("1") });
    await paymaster.deposit({ value: ethers.parseEther("5") });

    // Mint tokens to user
    await feeToken.mint(user.address, ethers.parseUnits("10000", 6));

    // User approves paymaster
    await feeToken.connect(user).approve(await paymaster.getAddress(), ethers.parseUnits("10000", 6));

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

  // Helper to create valid paymaster data with signature
  async function createPaymasterData(
    paymaster: TestableGasXERC20,
    oracleSigner: SignerWithAddress,
    userOpHash: string,
    price: bigint,
    expiry: number,
  ): Promise<string> {
    // Create the price hash
    const priceHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256", "uint48"], [userOpHash, price, expiry]),
    );

    // Sign it as ethSignedMessageHash
    const signature = await oracleSigner.signMessage(ethers.getBytes(priceHash));

    // Encode paymaster data
    const paymasterAddress = await paymaster.getAddress();
    const verificationGasLimit = 100000n;
    const postOpGasLimit = 100000n;

    // Pack: address(20) + uint128(16) + uint128(16) + price(32) + expiry(6) + signature
    const priceBytes = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [price]);
    const expiryBytes = ethers.solidityPacked(["uint48"], [expiry]);

    return ethers.concat([
      paymasterAddress,
      ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16),
      ethers.zeroPadValue(ethers.toBeHex(postOpGasLimit), 16),
      priceBytes,
      expiryBytes,
      signature,
    ]);
  }

  // Base UserOperation template
  const opTemplate = {
    sender: "" as string,
    nonce: 0n,
    initCode: "0x",
    callData: "0x",
    accountGasLimits: ethers.ZeroHash,
    preVerificationGas: 0n,
    gasFees: ethers.ZeroHash,
    paymasterAndData: "0x",
    signature: "0x",
  };

  describe("Validation Logic", function () {
    it("Should validate a properly signed UserOperation", async function () {
      const { paymaster, oracleSigner, user } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const futureExpiry = (await time.latest()) + 3600; // 1 hour from now
      const maxCost = ethers.parseEther("0.01"); // 0.01 ETH gas cost

      const paymasterData = await createPaymasterData(paymaster, oracleSigner, userOpHash, MOCK_PRICE, futureExpiry);

      const op = {
        ...opTemplate,
        sender: user.address,
        paymasterAndData: paymasterData,
      };

      const [ctx, validationData] = await paymaster.exposedValidate(op as any, userOpHash, maxCost);

      // Context should contain price, sender, and userOpHash
      expect(ctx).to.not.equal("0x");
      expect(validationData).to.equal(0n);

      // Decode context to verify
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256", "address", "bytes32"], ctx);
      expect(decoded[1]).to.equal(user.address);
      expect(decoded[2]).to.equal(userOpHash);
    });

    it("Should reject when paused", async function () {
      const { paymaster, oracleSigner, user, owner } = await loadFixture(deployTestableFixture);

      await paymaster.connect(owner).pause();

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const futureExpiry = (await time.latest()) + 3600;
      const maxCost = ethers.parseEther("0.01");

      const paymasterData = await createPaymasterData(paymaster, oracleSigner, userOpHash, MOCK_PRICE, futureExpiry);

      const op = {
        ...opTemplate,
        sender: user.address,
        paymasterAndData: paymasterData,
      };

      // whenNotPaused modifier uses OpenZeppelin's EnforcedPause() custom error
      await expect(paymaster.exposedValidate(op as any, userOpHash, maxCost)).to.be.revertedWithCustomError(
        paymaster,
        "EnforcedPause",
      );
    });

    it("Should reject expired signature", async function () {
      const { paymaster, oracleSigner, user } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const pastExpiry = (await time.latest()) - 1; // Already expired
      const maxCost = ethers.parseEther("0.01");

      const paymasterData = await createPaymasterData(paymaster, oracleSigner, userOpHash, MOCK_PRICE, pastExpiry);

      const op = {
        ...opTemplate,
        sender: user.address,
        paymasterAndData: paymasterData,
      };

      await expect(paymaster.exposedValidate(op as any, userOpHash, maxCost)).to.be.revertedWith(
        "GasX: Signature expired",
      );
    });

    it("Should reject invalid signature", async function () {
      const { paymaster, user, treasury } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const futureExpiry = (await time.latest()) + 3600;
      const maxCost = ethers.parseEther("0.01");

      // Sign with wrong signer (treasury instead of oracleSigner)
      const paymasterData = await createPaymasterData(paymaster, treasury, userOpHash, MOCK_PRICE, futureExpiry);

      const op = {
        ...opTemplate,
        sender: user.address,
        paymasterAndData: paymasterData,
      };

      await expect(paymaster.exposedValidate(op as any, userOpHash, maxCost)).to.be.revertedWith(
        "GasX: Invalid signature",
      );
    });

    it("Should reject price deviation too high", async function () {
      const { paymaster, oracleSigner, user } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const futureExpiry = (await time.latest()) + 3600;
      const maxCost = ethers.parseEther("0.01");

      // Use a price that deviates too much (> 5% deviation)
      const deviatedPrice = MOCK_PRICE * 2n; // 100% deviation

      const paymasterData = await createPaymasterData(paymaster, oracleSigner, userOpHash, deviatedPrice, futureExpiry);

      const op = {
        ...opTemplate,
        sender: user.address,
        paymasterAndData: paymasterData,
      };

      await expect(paymaster.exposedValidate(op as any, userOpHash, maxCost)).to.be.revertedWith(
        "GasX: Price deviation too high",
      );
    });

    it("Should reject insufficient user balance", async function () {
      const { paymaster, oracleSigner, treasury, feeToken } = await loadFixture(deployTestableFixture);

      // Treasury has no balance
      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const futureExpiry = (await time.latest()) + 3600;
      const maxCost = ethers.parseEther("0.01");

      // Approve paymaster from treasury (but treasury has no balance)
      await feeToken.connect(treasury).approve(await paymaster.getAddress(), ethers.parseUnits("10000", 6));

      const paymasterData = await createPaymasterData(paymaster, oracleSigner, userOpHash, MOCK_PRICE, futureExpiry);

      const op = {
        ...opTemplate,
        sender: treasury.address,
        paymasterAndData: paymasterData,
      };

      await expect(paymaster.exposedValidate(op as any, userOpHash, maxCost)).to.be.revertedWith(
        "GasX: Insufficient balance",
      );
    });

    it("Should reject insufficient user allowance", async function () {
      const { paymaster, oracleSigner, feeToken } = await loadFixture(deployTestableFixture);

      // Create a new user with balance but no allowance
      const [, , , , newUser] = await ethers.getSigners();
      await feeToken.mint(newUser.address, ethers.parseUnits("10000", 6));
      // Don't approve paymaster

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const futureExpiry = (await time.latest()) + 3600;
      const maxCost = ethers.parseEther("0.01");

      const paymasterData = await createPaymasterData(paymaster, oracleSigner, userOpHash, MOCK_PRICE, futureExpiry);

      const op = {
        ...opTemplate,
        sender: newUser.address,
        paymasterAndData: paymasterData,
      };

      await expect(paymaster.exposedValidate(op as any, userOpHash, maxCost)).to.be.revertedWith(
        "GasX: Insufficient allowance",
      );
    });

    it("Should reject invalid paymaster data length", async function () {
      const { paymaster, user } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const maxCost = ethers.parseEther("0.01");

      // Create invalid (too short) paymaster data
      const paymasterAddress = await paymaster.getAddress();
      const invalidData = ethers.concat([
        paymasterAddress,
        ethers.zeroPadValue(ethers.toBeHex(100000n), 16),
        ethers.zeroPadValue(ethers.toBeHex(100000n), 16),
        // Missing price, expiry, and signature
      ]);

      const op = {
        ...opTemplate,
        sender: user.address,
        paymasterAndData: invalidData,
      };

      await expect(paymaster.exposedValidate(op as any, userOpHash, maxCost)).to.be.revertedWith(
        "GasX: Invalid paymaster data length",
      );
    });

    it("Should reject when on-chain price is zero (via oracle aggregator)", async function () {
      const { paymaster, oracleSigner, user, mockOracle } = await loadFixture(deployTestableFixture);

      // Set oracle to return 0 - the aggregator will reject this with "zero quote"
      await mockOracle.setQuote(0);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const futureExpiry = (await time.latest()) + 3600;
      const maxCost = ethers.parseEther("0.01");

      const paymasterData = await createPaymasterData(paymaster, oracleSigner, userOpHash, MOCK_PRICE, futureExpiry);

      const op = {
        ...opTemplate,
        sender: user.address,
        paymasterAndData: paymasterData,
      };

      // The aggregator rejects zero quotes before the paymaster can check
      // We need to get the aggregator contract to check against its custom error
      const oracleAddress = await paymaster.priceOracle();
      const aggregator = await ethers.getContractAt("MultiOracleAggregator", oracleAddress);
      await expect(paymaster.exposedValidate(op as any, userOpHash, maxCost)).to.be.revertedWithCustomError(
        aggregator,
        "ZeroQuote",
      );
    });

    it("Should accept when off-chain price is slightly lower than on-chain (within 5%)", async function () {
      const { paymaster, oracleSigner, user } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const futureExpiry = (await time.latest()) + 3600;
      const maxCost = ethers.parseEther("0.01");

      // Use an off-chain price that is 4% lower than the mock price (within 5% tolerance)
      const slightlyLowerPrice = (MOCK_PRICE * 96n) / 100n;

      const paymasterData = await createPaymasterData(
        paymaster,
        oracleSigner,
        userOpHash,
        slightlyLowerPrice,
        futureExpiry,
      );

      const op = {
        ...opTemplate,
        sender: user.address,
        paymasterAndData: paymasterData,
      };

      // Should succeed since deviation is within 5%
      const [, validationData] = await paymaster.exposedValidate(op as any, userOpHash, maxCost);
      expect(validationData).to.equal(0n);
    });
  });

  describe("PostOp Fee Collection", function () {
    it("Should collect fees on successful operation", async function () {
      const { paymaster, user, feeToken } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const actualGasCost = ethers.parseEther("0.001"); // 0.001 ETH

      // Create context (as returned from validation)
      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "bytes32"],
        [MOCK_PRICE, user.address, userOpHash],
      );

      const balanceBefore = await feeToken.balanceOf(await paymaster.getAddress());

      // Execute postOp
      await paymaster.exposedPostOp(context, actualGasCost, 0);

      const balanceAfter = await feeToken.balanceOf(await paymaster.getAddress());

      // Paymaster should have received fees
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should emit FeeCharged event", async function () {
      const { paymaster, user } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const actualGasCost = ethers.parseEther("0.001");

      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "bytes32"],
        [MOCK_PRICE, user.address, userOpHash],
      );

      await expect(paymaster.exposedPostOp(context, actualGasCost, 0)).to.emit(paymaster, "FeeCharged");
    });

    it("Should update totalFeesCollected", async function () {
      const { paymaster, user } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const actualGasCost = ethers.parseEther("0.001");

      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "bytes32"],
        [MOCK_PRICE, user.address, userOpHash],
      );

      const feesBefore = await paymaster.totalFeesCollected();

      await paymaster.exposedPostOp(context, actualGasCost, 0);

      const feesAfter = await paymaster.totalFeesCollected();

      expect(feesAfter).to.be.gt(feesBefore);
    });

    it("Should apply minimum fee when calculated fee is too low", async function () {
      const { paymaster, user, feeToken } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const verySmallGasCost = 1n; // Extremely small gas cost

      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "bytes32"],
        [MOCK_PRICE, user.address, userOpHash],
      );

      const balanceBefore = await feeToken.balanceOf(await paymaster.getAddress());

      await paymaster.exposedPostOp(context, verySmallGasCost, 0);

      const balanceAfter = await feeToken.balanceOf(await paymaster.getAddress());

      // Fee collected should be at least minFee
      expect(balanceAfter - balanceBefore).to.be.gte(MIN_FEE);
    });

    it("Should not collect fees when operation failed", async function () {
      const { paymaster, user, feeToken } = await loadFixture(deployTestableFixture);

      const userOpHash = ethers.keccak256(ethers.toUtf8Bytes("test-op"));
      const actualGasCost = ethers.parseEther("0.001");

      const context = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "bytes32"],
        [MOCK_PRICE, user.address, userOpHash],
      );

      const balanceBefore = await feeToken.balanceOf(await paymaster.getAddress());

      // Execute postOp with failed mode
      await paymaster.exposedPostOpFailed(context, actualGasCost, 0);

      const balanceAfter = await feeToken.balanceOf(await paymaster.getAddress());

      // No fees should be collected on failure
      expect(balanceAfter).to.equal(balanceBefore);
    });
  });

  describe("Emergency ETH Withdrawal", function () {
    it("Should receive ETH directly", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("0.1");
      await owner.sendTransaction({
        to: await paymaster.getAddress(),
        value: amount,
      });

      const balance = await ethers.provider.getBalance(await paymaster.getAddress());
      expect(balance).to.equal(amount);
    });

    it("Should allow owner to withdraw all ETH with amount=0", async function () {
      const { paymaster, owner, treasury } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("0.1");
      const paymasterAddr = await paymaster.getAddress();

      // Send ETH to paymaster
      await owner.sendTransaction({
        to: paymasterAddr,
        value: amount,
      });

      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);

      // Withdraw all with amount=0
      await paymaster.connect(owner).emergencyWithdrawEth(treasury.address, 0);

      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      const paymasterBalance = await ethers.provider.getBalance(paymasterAddr);

      expect(paymasterBalance).to.equal(0n);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(amount);
    });

    it("Should allow owner to withdraw specific amount", async function () {
      const { paymaster, owner, treasury } = await loadFixture(deployFixture);

      const depositAmount = ethers.parseEther("0.5");
      const withdrawAmount = ethers.parseEther("0.2");
      const paymasterAddr = await paymaster.getAddress();

      // Send ETH to paymaster
      await owner.sendTransaction({
        to: paymasterAddr,
        value: depositAmount,
      });

      await paymaster.connect(owner).emergencyWithdrawEth(treasury.address, withdrawAmount);

      const paymasterBalance = await ethers.provider.getBalance(paymasterAddr);
      expect(paymasterBalance).to.equal(depositAmount - withdrawAmount);
    });

    it("Should emit EmergencyWithdraw event", async function () {
      const { paymaster, owner, treasury } = await loadFixture(deployFixture);

      const amount = ethers.parseEther("0.1");
      const paymasterAddr = await paymaster.getAddress();

      // Send ETH to paymaster
      await owner.sendTransaction({
        to: paymasterAddr,
        value: amount,
      });

      await expect(paymaster.connect(owner).emergencyWithdrawEth(treasury.address, amount))
        .to.emit(paymaster, "EmergencyWithdraw")
        .withArgs(treasury.address, amount);
    });

    it("Should reject withdrawal to zero address", async function () {
      const { paymaster, owner } = await loadFixture(deployFixture);

      await expect(paymaster.connect(owner).emergencyWithdrawEth(ethers.ZeroAddress, 0)).to.be.revertedWith(
        "GasX: Invalid recipient",
      );
    });

    it("Should reject withdrawal exceeding balance", async function () {
      const { paymaster, owner, treasury } = await loadFixture(deployFixture);

      const excessiveAmount = ethers.parseEther("1000");
      await expect(paymaster.connect(owner).emergencyWithdrawEth(treasury.address, excessiveAmount)).to.be.revertedWith(
        "GasX: Insufficient balance",
      );
    });

    it("Should only allow owner to call emergencyWithdrawEth", async function () {
      const { paymaster, user, treasury } = await loadFixture(deployFixture);

      await expect(paymaster.connect(user).emergencyWithdrawEth(treasury.address, 0)).to.be.reverted;
    });
  });
});
