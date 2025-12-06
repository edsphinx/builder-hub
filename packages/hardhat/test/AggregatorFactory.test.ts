import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { AggregatorFactory, MockOracle } from "../typechain-types";
import { parseUnits } from "ethers";

describe("AggregatorFactory", function () {
  const BASE = "0x0000000000000000000000000000000000000001";
  const QUOTE = "0x0000000000000000000000000000000000000002";
  const MAX_DEVIATION_BPS = 1000n; // 10%

  async function deployFixture() {
    const [owner, user, newOwner] = await ethers.getSigners();

    // Deploy MultiOracleAggregator implementation
    const AggregatorFactory = await ethers.getContractFactory("MultiOracleAggregator");
    const implementation = await AggregatorFactory.deploy();
    await implementation.waitForDeployment();

    // Deploy AggregatorFactory
    const FactoryFactory = await ethers.getContractFactory("AggregatorFactory");
    const factory = (await FactoryFactory.deploy(await implementation.getAddress())) as AggregatorFactory;
    await factory.waitForDeployment();

    // Deploy mock oracles
    const MockOracleFactory = await ethers.getContractFactory("MockOracle");
    const oracle1 = (await MockOracleFactory.deploy(parseUnits("1.0", 18))) as MockOracle;
    const oracle2 = (await MockOracleFactory.deploy(parseUnits("1.02", 18))) as MockOracle;
    await oracle1.waitForDeployment();
    await oracle2.waitForDeployment();

    return { factory, implementation, oracle1, oracle2, owner, user, newOwner };
  }

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      const { factory, owner } = await loadFixture(deployFixture);
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("should set the correct implementation", async function () {
      const { factory, implementation } = await loadFixture(deployFixture);
      expect(await factory.aggregatorImplementation()).to.equal(await implementation.getAddress());
    });

    it("should emit OwnershipTransferred event on deployment", async function () {
      const [owner] = await ethers.getSigners();
      const AggregatorFactory = await ethers.getContractFactory("MultiOracleAggregator");
      const implementation = await AggregatorFactory.deploy();
      await implementation.waitForDeployment();

      const FactoryFactory = await ethers.getContractFactory("AggregatorFactory");
      const newFactory = await FactoryFactory.deploy(await implementation.getAddress());

      // Check the deployment transaction emitted the event
      const deployTx = newFactory.deploymentTransaction();
      await expect(deployTx).to.emit(newFactory, "OwnershipTransferred").withArgs(ethers.ZeroAddress, owner.address);
    });

    it("should revert with ZeroImplementation when deploying with zero address", async function () {
      const FactoryFactory = await ethers.getContractFactory("AggregatorFactory");
      await expect(FactoryFactory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        FactoryFactory,
        "ZeroImplementation",
      );
    });
  });

  describe("transferOwnership", function () {
    it("should transfer ownership to new owner", async function () {
      const { factory, owner, newOwner } = await loadFixture(deployFixture);

      await expect(factory.transferOwnership(newOwner.address))
        .to.emit(factory, "OwnershipTransferred")
        .withArgs(owner.address, newOwner.address);

      expect(await factory.owner()).to.equal(newOwner.address);
    });

    it("should revert when called by non-owner", async function () {
      const { factory, user, newOwner } = await loadFixture(deployFixture);
      await expect(factory.connect(user).transferOwnership(newOwner.address)).to.be.revertedWith("not owner");
    });

    it("should revert when transferring to zero address", async function () {
      const { factory } = await loadFixture(deployFixture);
      await expect(factory.transferOwnership(ethers.ZeroAddress)).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });

    it("should revert when transferring to same owner", async function () {
      const { factory, owner } = await loadFixture(deployFixture);
      await expect(factory.transferOwnership(owner.address)).to.be.revertedWithCustomError(factory, "SameOwner");
    });
  });

  describe("createAggregator", function () {
    it("should create aggregator successfully", async function () {
      const { factory, oracle1 } = await loadFixture(deployFixture);

      const tx = await factory.createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS);
      await tx.wait();

      // Check events
      await expect(tx)
        .to.emit(factory, "AggregatorCreated")
        .withArgs(BASE, QUOTE, await factory.getAggregator(BASE, QUOTE));
      await expect(tx).to.emit(factory, "MaxDeviationUpdated").withArgs(BASE, QUOTE, MAX_DEVIATION_BPS);

      // Check aggregator exists
      expect(await factory.existsAggregator(BASE, QUOTE)).to.equal(true);
      expect(await factory.getAggregator(BASE, QUOTE)).to.not.equal(ethers.ZeroAddress);
    });

    it("should create aggregator with multiple oracles", async function () {
      const { factory, oracle1, oracle2 } = await loadFixture(deployFixture);

      await factory.createAggregator(
        BASE,
        QUOTE,
        [await oracle1.getAddress(), await oracle2.getAddress()],
        MAX_DEVIATION_BPS,
      );

      const aggAddress = await factory.getAggregator(BASE, QUOTE);
      const aggregator = await ethers.getContractAt("MultiOracleAggregator", aggAddress);
      expect(await aggregator.oracleCount(BASE, QUOTE)).to.equal(2);
    });

    it("should revert when called by non-owner", async function () {
      const { factory, oracle1, user } = await loadFixture(deployFixture);
      await expect(
        factory.connect(user).createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS),
      ).to.be.revertedWith("not owner");
    });

    it("should revert with ZeroAddress for base", async function () {
      const { factory, oracle1 } = await loadFixture(deployFixture);
      await expect(
        factory.createAggregator(ethers.ZeroAddress, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS),
      ).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });

    it("should revert with ZeroAddress for quote", async function () {
      const { factory, oracle1 } = await loadFixture(deployFixture);
      await expect(
        factory.createAggregator(BASE, ethers.ZeroAddress, [await oracle1.getAddress()], MAX_DEVIATION_BPS),
      ).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });

    it("should revert with IdenticalTokens when base equals quote", async function () {
      const { factory, oracle1 } = await loadFixture(deployFixture);
      await expect(
        factory.createAggregator(BASE, BASE, [await oracle1.getAddress()], MAX_DEVIATION_BPS),
      ).to.be.revertedWithCustomError(factory, "IdenticalTokens");
    });

    it("should revert with AggregatorAlreadyExists when aggregator exists", async function () {
      const { factory, oracle1 } = await loadFixture(deployFixture);

      await factory.createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS);

      // The call should revert with custom error and emit event before reverting
      await expect(
        factory.createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS),
      ).to.be.revertedWithCustomError(factory, "AggregatorAlreadyExists");
    });

    it("should revert with ReversePairExists when reverse pair exists", async function () {
      const { factory, oracle1 } = await loadFixture(deployFixture);

      await factory.createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS);

      // The call should revert with custom error
      await expect(
        factory.createAggregator(QUOTE, BASE, [await oracle1.getAddress()], MAX_DEVIATION_BPS),
      ).to.be.revertedWithCustomError(factory, "ReversePairExists");
    });

    it("should revert with NoOracles when oracle array is empty", async function () {
      const { factory } = await loadFixture(deployFixture);
      await expect(factory.createAggregator(BASE, QUOTE, [], MAX_DEVIATION_BPS)).to.be.revertedWithCustomError(
        factory,
        "NoOracles",
      );
    });
  });

  describe("removeAggregator", function () {
    it("should remove aggregator successfully", async function () {
      const { factory, oracle1 } = await loadFixture(deployFixture);

      await factory.createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS);
      expect(await factory.existsAggregator(BASE, QUOTE)).to.equal(true);

      await expect(factory.removeAggregator(BASE, QUOTE)).to.emit(factory, "AggregatorRemoved").withArgs(BASE, QUOTE);

      expect(await factory.existsAggregator(BASE, QUOTE)).to.equal(false);
      expect(await factory.getAggregator(BASE, QUOTE)).to.equal(ethers.ZeroAddress);
    });

    it("should revert when called by non-owner", async function () {
      const { factory, oracle1, user } = await loadFixture(deployFixture);
      await factory.createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS);
      await expect(factory.connect(user).removeAggregator(BASE, QUOTE)).to.be.revertedWith("not owner");
    });

    it("should revert with AggregatorNotFound when aggregator does not exist", async function () {
      const { factory } = await loadFixture(deployFixture);
      await expect(factory.removeAggregator(BASE, QUOTE)).to.be.revertedWithCustomError(factory, "AggregatorNotFound");
    });
  });

  describe("transferAggregatorOwnership", function () {
    it("should transfer aggregator ownership successfully", async function () {
      const { factory, oracle1, newOwner } = await loadFixture(deployFixture);

      await factory.createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS);

      await expect(factory.transferAggregatorOwnership(BASE, QUOTE, newOwner.address))
        .to.emit(factory, "AggregatorOwnershipTransferred")
        .withArgs(BASE, QUOTE, newOwner.address);

      const aggAddress = await factory.getAggregator(BASE, QUOTE);
      const aggregator = await ethers.getContractAt("MultiOracleAggregator", aggAddress);
      expect(await aggregator.owner()).to.equal(newOwner.address);
    });

    it("should revert when called by non-owner", async function () {
      const { factory, oracle1, user, newOwner } = await loadFixture(deployFixture);
      await factory.createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS);
      await expect(factory.connect(user).transferAggregatorOwnership(BASE, QUOTE, newOwner.address)).to.be.revertedWith(
        "not owner",
      );
    });

    it("should revert with AggregatorNotFound when aggregator does not exist", async function () {
      const { factory, newOwner } = await loadFixture(deployFixture);
      await expect(factory.transferAggregatorOwnership(BASE, QUOTE, newOwner.address)).to.be.revertedWithCustomError(
        factory,
        "AggregatorNotFound",
      );
    });

    it("should revert with ZeroAddress when new owner is zero", async function () {
      const { factory, oracle1 } = await loadFixture(deployFixture);
      await factory.createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS);
      await expect(factory.transferAggregatorOwnership(BASE, QUOTE, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        factory,
        "ZeroAddress",
      );
    });
  });

  describe("getAggregator and existsAggregator", function () {
    it("should return zero address for non-existent aggregator", async function () {
      const { factory } = await loadFixture(deployFixture);
      expect(await factory.getAggregator(BASE, QUOTE)).to.equal(ethers.ZeroAddress);
    });

    it("should return false for non-existent aggregator", async function () {
      const { factory } = await loadFixture(deployFixture);
      expect(await factory.existsAggregator(BASE, QUOTE)).to.equal(false);
    });

    it("should return correct aggregator address after creation", async function () {
      const { factory, oracle1 } = await loadFixture(deployFixture);
      await factory.createAggregator(BASE, QUOTE, [await oracle1.getAddress()], MAX_DEVIATION_BPS);

      const aggAddress = await factory.getAggregator(BASE, QUOTE);
      expect(aggAddress).to.not.equal(ethers.ZeroAddress);
      expect(await factory.existsAggregator(BASE, QUOTE)).to.equal(true);
    });
  });

  describe("quoteViaFactory", function () {
    it("should get quote using average method", async function () {
      const { factory, oracle1, oracle2 } = await loadFixture(deployFixture);

      await factory.createAggregator(
        BASE,
        QUOTE,
        [await oracle1.getAddress(), await oracle2.getAddress()],
        MAX_DEVIATION_BPS,
      );

      const amount = parseUnits("1", 18);
      const tx = await factory.quoteViaFactory(BASE, QUOTE, amount, false);

      await expect(tx)
        .to.emit(factory, "QuoteRequested")
        .withArgs(await factory.owner(), BASE, QUOTE, amount, "average");
    });

    it("should get quote using median method", async function () {
      const { factory, oracle1, oracle2 } = await loadFixture(deployFixture);

      await factory.createAggregator(
        BASE,
        QUOTE,
        [await oracle1.getAddress(), await oracle2.getAddress()],
        MAX_DEVIATION_BPS,
      );

      const amount = parseUnits("1", 18);
      const tx = await factory.quoteViaFactory(BASE, QUOTE, amount, true);

      await expect(tx)
        .to.emit(factory, "QuoteRequested")
        .withArgs(await factory.owner(), BASE, QUOTE, amount, "median");
    });

    it("should revert with AggregatorNotFound when aggregator does not exist", async function () {
      const { factory } = await loadFixture(deployFixture);
      await expect(factory.quoteViaFactory(BASE, QUOTE, parseUnits("1", 18), false)).to.be.revertedWithCustomError(
        factory,
        "AggregatorNotFound",
      );
    });
  });
});
