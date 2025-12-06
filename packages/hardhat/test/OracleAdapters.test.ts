import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { parseUnits } from "ethers";
import { DIAOracleAdapter, EulerOracleAdapter, DIAAdapterFactory } from "../typechain-types";

describe("Oracle Adapters", function () {
  const BASE = "0x0000000000000000000000000000000000000001";
  const QUOTE = "0x0000000000000000000000000000000000000002";

  describe("DIAOracleAdapter", function () {
    async function deployDIAFixture() {
      const [owner, user] = await ethers.getSigners();

      // Deploy MockDIAOracle
      const MockDIAFactory = await ethers.getContractFactory("MockDIAOracle");
      const diaOracle = await MockDIAFactory.deploy();
      await diaOracle.waitForDeployment();

      // Set initial price
      const currentTime = await time.latest();
      await diaOracle.setValue("ETH/USD", 200000000000n, BigInt(currentTime)); // $2000 with 8 decimals

      // Deploy DIAOracleAdapter
      const AdapterFactory = await ethers.getContractFactory("DIAOracleAdapter");
      const adapter = (await AdapterFactory.deploy(
        await diaOracle.getAddress(),
        BASE,
        QUOTE,
        "ETH/USD",
      )) as DIAOracleAdapter;
      await adapter.waitForDeployment();

      return { adapter, diaOracle, owner, user };
    }

    describe("Deployment", function () {
      it("should set the correct DIA oracle address", async function () {
        const { adapter, diaOracle } = await loadFixture(deployDIAFixture);
        expect(await adapter.dia()).to.equal(await diaOracle.getAddress());
      });

      it("should set the correct owner", async function () {
        const { adapter, owner } = await loadFixture(deployDIAFixture);
        expect(await adapter.owner()).to.equal(owner.address);
      });

      it("should set the initial pair key", async function () {
        const { adapter } = await loadFixture(deployDIAFixture);
        expect(await adapter.pairKeys(BASE, QUOTE)).to.equal("ETH/USD");
      });

      it("should emit PairKeySet event on deployment", async function () {
        const MockDIAFactory = await ethers.getContractFactory("MockDIAOracle");
        const diaOracle = await MockDIAFactory.deploy();
        await diaOracle.waitForDeployment();

        const AdapterFactory = await ethers.getContractFactory("DIAOracleAdapter");
        const adapter = await AdapterFactory.deploy(await diaOracle.getAddress(), BASE, QUOTE, "ETH/USD");

        const deployTx = adapter.deploymentTransaction();
        await expect(deployTx).to.emit(adapter, "PairKeySet").withArgs(BASE, QUOTE, "ETH/USD");
      });

      it("should revert with ZeroAddress when DIA oracle is zero", async function () {
        const AdapterFactory = await ethers.getContractFactory("DIAOracleAdapter");
        await expect(AdapterFactory.deploy(ethers.ZeroAddress, BASE, QUOTE, "ETH/USD")).to.be.revertedWithCustomError(
          AdapterFactory,
          "ZeroAddress",
        );
      });

      it("should revert with ZeroAddress when base is zero", async function () {
        const MockDIAFactory = await ethers.getContractFactory("MockDIAOracle");
        const diaOracle = await MockDIAFactory.deploy();
        await diaOracle.waitForDeployment();

        const AdapterFactory = await ethers.getContractFactory("DIAOracleAdapter");
        await expect(
          AdapterFactory.deploy(await diaOracle.getAddress(), ethers.ZeroAddress, QUOTE, "ETH/USD"),
        ).to.be.revertedWithCustomError(AdapterFactory, "ZeroAddress");
      });

      it("should revert with ZeroAddress when quote is zero", async function () {
        const MockDIAFactory = await ethers.getContractFactory("MockDIAOracle");
        const diaOracle = await MockDIAFactory.deploy();
        await diaOracle.waitForDeployment();

        const AdapterFactory = await ethers.getContractFactory("DIAOracleAdapter");
        await expect(
          AdapterFactory.deploy(await diaOracle.getAddress(), BASE, ethers.ZeroAddress, "ETH/USD"),
        ).to.be.revertedWithCustomError(AdapterFactory, "ZeroAddress");
      });
    });

    describe("setPairKey", function () {
      it("should allow owner to set pair key", async function () {
        const { adapter } = await loadFixture(deployDIAFixture);
        const newBase = "0x0000000000000000000000000000000000000003";
        const newQuote = "0x0000000000000000000000000000000000000004";

        await expect(adapter.setPairKey(newBase, newQuote, "BTC/USD"))
          .to.emit(adapter, "PairKeySet")
          .withArgs(newBase, newQuote, "BTC/USD");

        expect(await adapter.pairKeys(newBase, newQuote)).to.equal("BTC/USD");
      });

      it("should revert when called by non-owner", async function () {
        const { adapter, user } = await loadFixture(deployDIAFixture);
        await expect(adapter.connect(user).setPairKey(BASE, QUOTE, "BTC/USD")).to.be.revertedWith("not owner");
      });

      it("should revert with ZeroAddress when base is zero", async function () {
        const { adapter } = await loadFixture(deployDIAFixture);
        await expect(adapter.setPairKey(ethers.ZeroAddress, QUOTE, "BTC/USD")).to.be.revertedWithCustomError(
          adapter,
          "ZeroAddress",
        );
      });

      it("should revert with ZeroAddress when quote is zero", async function () {
        const { adapter } = await loadFixture(deployDIAFixture);
        await expect(adapter.setPairKey(BASE, ethers.ZeroAddress, "BTC/USD")).to.be.revertedWithCustomError(
          adapter,
          "ZeroAddress",
        );
      });
    });

    describe("getQuote", function () {
      it("should return correct quote", async function () {
        const { adapter, diaOracle } = await loadFixture(deployDIAFixture);

        // Update price to current time
        const currentTime = await time.latest();
        await diaOracle.setValue("ETH/USD", 200000000000n, BigInt(currentTime)); // $2000 with 8 decimals

        const amount = parseUnits("1", 18); // 1 ETH
        const quote = await adapter.getQuote(amount, BASE, QUOTE);

        // Expected: (1e18 * 2000e8) / 1e8 = 2000e18
        expect(quote).to.equal(parseUnits("2000", 18));
      });

      it("should revert with PairNotSet when pair key is not set", async function () {
        const { adapter } = await loadFixture(deployDIAFixture);
        const unknownBase = "0x0000000000000000000000000000000000000005";
        const unknownQuote = "0x0000000000000000000000000000000000000006";

        await expect(adapter.getQuote(parseUnits("1", 18), unknownBase, unknownQuote)).to.be.revertedWithCustomError(
          adapter,
          "PairNotSet",
        );
      });

      it("should revert with ZeroPrice when price is zero", async function () {
        const { adapter, diaOracle } = await loadFixture(deployDIAFixture);
        const currentTime = await time.latest();
        await diaOracle.setValue("ETH/USD", 0n, BigInt(currentTime));

        await expect(adapter.getQuote(parseUnits("1", 18), BASE, QUOTE)).to.be.revertedWithCustomError(
          adapter,
          "ZeroPrice",
        );
      });

      it("should revert with StalePrice when price is older than 1 hour", async function () {
        const { adapter, diaOracle } = await loadFixture(deployDIAFixture);

        // Set price with timestamp older than 1 hour
        const currentTime = await time.latest();
        const staleTime = currentTime - 3601; // More than 1 hour ago
        await diaOracle.setValue("ETH/USD", 200000000000n, BigInt(staleTime));

        await expect(adapter.getQuote(parseUnits("1", 18), BASE, QUOTE)).to.be.revertedWithCustomError(
          adapter,
          "StalePrice",
        );
      });
    });
  });

  describe("EulerOracleAdapter", function () {
    async function deployEulerFixture() {
      const [owner, user] = await ethers.getSigners();

      // Deploy MockEulerOracle
      const MockEulerFactory = await ethers.getContractFactory("MockEulerOracle");
      const eulerOracle = await MockEulerFactory.deploy();
      await eulerOracle.waitForDeployment();
      await eulerOracle.setPrice(parseUnits("2000", 18)); // 1 ETH = 2000 USDC

      // Deploy EulerOracleAdapter
      const AdapterFactory = await ethers.getContractFactory("EulerOracleAdapter");
      const adapter = (await AdapterFactory.deploy(await eulerOracle.getAddress(), BASE, QUOTE)) as EulerOracleAdapter;
      await adapter.waitForDeployment();

      return { adapter, eulerOracle, owner, user };
    }

    describe("Deployment", function () {
      it("should set the correct Euler oracle address", async function () {
        const { adapter, eulerOracle } = await loadFixture(deployEulerFixture);
        expect(await adapter.euler()).to.equal(await eulerOracle.getAddress());
      });

      it("should set the correct base token", async function () {
        const { adapter } = await loadFixture(deployEulerFixture);
        expect(await adapter.base()).to.equal(BASE);
      });

      it("should set the correct quote token", async function () {
        const { adapter } = await loadFixture(deployEulerFixture);
        expect(await adapter.quote()).to.equal(QUOTE);
      });

      it("should revert with ZeroAddress when Euler oracle is zero", async function () {
        const AdapterFactory = await ethers.getContractFactory("EulerOracleAdapter");
        await expect(AdapterFactory.deploy(ethers.ZeroAddress, BASE, QUOTE)).to.be.revertedWithCustomError(
          AdapterFactory,
          "ZeroAddress",
        );
      });

      it("should revert with NotContract when Euler oracle is not a contract", async function () {
        const [owner] = await ethers.getSigners();
        const AdapterFactory = await ethers.getContractFactory("EulerOracleAdapter");
        await expect(AdapterFactory.deploy(owner.address, BASE, QUOTE)).to.be.revertedWithCustomError(
          AdapterFactory,
          "NotContract",
        );
      });

      it("should revert with ZeroAddress when base is zero", async function () {
        const MockEulerFactory = await ethers.getContractFactory("MockEulerOracle");
        const eulerOracle = await MockEulerFactory.deploy();
        await eulerOracle.waitForDeployment();

        const AdapterFactory = await ethers.getContractFactory("EulerOracleAdapter");
        await expect(
          AdapterFactory.deploy(await eulerOracle.getAddress(), ethers.ZeroAddress, QUOTE),
        ).to.be.revertedWithCustomError(AdapterFactory, "ZeroAddress");
      });

      it("should revert with ZeroAddress when quote is zero", async function () {
        const MockEulerFactory = await ethers.getContractFactory("MockEulerOracle");
        const eulerOracle = await MockEulerFactory.deploy();
        await eulerOracle.waitForDeployment();

        const AdapterFactory = await ethers.getContractFactory("EulerOracleAdapter");
        await expect(
          AdapterFactory.deploy(await eulerOracle.getAddress(), BASE, ethers.ZeroAddress),
        ).to.be.revertedWithCustomError(AdapterFactory, "ZeroAddress");
      });
    });

    describe("getQuote", function () {
      it("should return correct quote", async function () {
        const { adapter } = await loadFixture(deployEulerFixture);

        const amount = parseUnits("1", 18); // 1 ETH
        const quote = await adapter.getQuote(amount, BASE, QUOTE);

        // Expected: (1e18 * 2000e18) / 1e18 = 2000e18
        expect(quote).to.equal(parseUnits("2000", 18));
      });

      it("should revert with InvalidPair when base does not match", async function () {
        const { adapter } = await loadFixture(deployEulerFixture);
        const wrongBase = "0x0000000000000000000000000000000000000005";

        await expect(adapter.getQuote(parseUnits("1", 18), wrongBase, QUOTE)).to.be.revertedWithCustomError(
          adapter,
          "InvalidPair",
        );
      });

      it("should revert with InvalidPair when quote does not match", async function () {
        const { adapter } = await loadFixture(deployEulerFixture);
        const wrongQuote = "0x0000000000000000000000000000000000000005";

        await expect(adapter.getQuote(parseUnits("1", 18), BASE, wrongQuote)).to.be.revertedWithCustomError(
          adapter,
          "InvalidPair",
        );
      });

      it("should revert with ZeroPrice when price is zero", async function () {
        const { adapter, eulerOracle } = await loadFixture(deployEulerFixture);
        await eulerOracle.setMockPrice(0);

        await expect(adapter.getQuote(parseUnits("1", 18), BASE, QUOTE)).to.be.revertedWithCustomError(
          adapter,
          "ZeroPrice",
        );
      });
    });
  });

  describe("DIAAdapterFactory", function () {
    async function deployDIAFactoryFixture() {
      const [owner, user] = await ethers.getSigners();

      // Deploy MockDIAOracle
      const MockDIAFactory = await ethers.getContractFactory("MockDIAOracle");
      const diaOracle = await MockDIAFactory.deploy();
      await diaOracle.waitForDeployment();

      // Set initial price
      const currentTime = await time.latest();
      await diaOracle.setValue("ETH/USD", 200000000000n, BigInt(currentTime));

      // Deploy a mock aggregator (we just need an address)
      const MockAggregator = "0x0000000000000000000000000000000000000099";

      // Deploy DIAAdapterFactory
      const FactoryContract = await ethers.getContractFactory("DIAAdapterFactory");
      const factory = (await FactoryContract.deploy(MockAggregator, await diaOracle.getAddress())) as DIAAdapterFactory;
      await factory.waitForDeployment();

      return { factory, diaOracle, owner, user };
    }

    describe("Deployment", function () {
      it("should set the correct aggregator address", async function () {
        const { factory } = await loadFixture(deployDIAFactoryFixture);
        expect(await factory.aggregator()).to.equal("0x0000000000000000000000000000000000000099");
      });

      it("should set the correct DIA oracle address", async function () {
        const { factory, diaOracle } = await loadFixture(deployDIAFactoryFixture);
        expect(await factory.dia()).to.equal(await diaOracle.getAddress());
      });

      it("should set the correct owner", async function () {
        const { factory, owner } = await loadFixture(deployDIAFactoryFixture);
        expect(await factory.owner()).to.equal(owner.address);
      });

      it("should revert with ZeroAddress when aggregator is zero", async function () {
        const MockDIAFactory = await ethers.getContractFactory("MockDIAOracle");
        const diaOracle = await MockDIAFactory.deploy();
        await diaOracle.waitForDeployment();

        const FactoryContract = await ethers.getContractFactory("DIAAdapterFactory");
        await expect(
          FactoryContract.deploy(ethers.ZeroAddress, await diaOracle.getAddress()),
        ).to.be.revertedWithCustomError(FactoryContract, "ZeroAddress");
      });

      it("should revert with ZeroAddress when DIA oracle is zero", async function () {
        const FactoryContract = await ethers.getContractFactory("DIAAdapterFactory");
        await expect(
          FactoryContract.deploy("0x0000000000000000000000000000000000000099", ethers.ZeroAddress),
        ).to.be.revertedWithCustomError(FactoryContract, "ZeroAddress");
      });
    });

    describe("deployAdapter", function () {
      it("should deploy adapter successfully", async function () {
        const { factory } = await loadFixture(deployDIAFactoryFixture);

        const tx = await factory.deployAdapter(BASE, QUOTE, "ETH/USD");
        const receipt = await tx.wait();

        // Find the AdapterCreated event
        const event = receipt?.logs.find(log => {
          try {
            const parsed = factory.interface.parseLog({ topics: log.topics as string[], data: log.data });
            return parsed?.name === "AdapterCreated";
          } catch {
            return false;
          }
        });

        expect(event).to.not.equal(undefined);
      });

      it("should emit AdapterCreated event", async function () {
        const { factory } = await loadFixture(deployDIAFactoryFixture);

        await expect(factory.deployAdapter(BASE, QUOTE, "ETH/USD")).to.emit(factory, "AdapterCreated");
      });

      it("should revert when called by non-owner", async function () {
        const { factory, user } = await loadFixture(deployDIAFactoryFixture);
        await expect(factory.connect(user).deployAdapter(BASE, QUOTE, "ETH/USD")).to.be.revertedWith("not owner");
      });

      it("should revert with ZeroAddress when base is zero", async function () {
        const { factory } = await loadFixture(deployDIAFactoryFixture);
        await expect(factory.deployAdapter(ethers.ZeroAddress, QUOTE, "ETH/USD")).to.be.revertedWithCustomError(
          factory,
          "ZeroAddress",
        );
      });

      it("should revert with ZeroAddress when quote is zero", async function () {
        const { factory } = await loadFixture(deployDIAFactoryFixture);
        await expect(factory.deployAdapter(BASE, ethers.ZeroAddress, "ETH/USD")).to.be.revertedWithCustomError(
          factory,
          "ZeroAddress",
        );
      });

      it("should revert with ZeroKey when key is empty", async function () {
        const { factory } = await loadFixture(deployDIAFactoryFixture);
        await expect(factory.deployAdapter(BASE, QUOTE, "")).to.be.revertedWithCustomError(factory, "ZeroKey");
      });
    });
  });
});
