import { ethers, upgrades, network } from "hardhat";
import { expect } from "chai";
import { MultiOracleAggregator, MultiOracleAggregatorV2, MockOracle } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { parseUnits, Wallet } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("MultiOracleAggregator", () => {
  // Skip on non-local networks - this test deploys mock contracts
  before(function () {
    if (network.name !== "localhost" && network.name !== "hardhat") {
      console.log(`[INFO] Skipping MultiOracleAggregator tests - designed for local networks only.`);
      this.skip();
    }
  });
  async function deployAggregatorFixture() {
    const [owner] = await ethers.getSigners();
    const attacker = new Wallet(ethers.Wallet.createRandom().privateKey, ethers.provider);

    const createOracle = async (price: string): Promise<MockOracle> => {
      const Factory = await ethers.getContractFactory("MockOracle");
      const oracle = (await Factory.deploy(parseUnits(price, 18))) as MockOracle;
      await oracle.waitForDeployment();
      return oracle;
    };

    const AggregatorFactory = await ethers.getContractFactory("MultiOracleAggregator");
    const aggregator = (await upgrades.deployProxy(AggregatorFactory, [owner.address, 500], {
      kind: "uups",
    })) as MultiOracleAggregator;

    const mockOracle = await createOracle("1.0");

    const BASE = "0x0000000000000000000000000000000000000001";
    const QUOTE = "0x0000000000000000000000000000000000000002";

    return { aggregator, owner, attacker, mockOracle, createOracle, BASE, QUOTE };
  }

  // Declare variables in the top-level scope
  let aggregator: MultiOracleAggregator;
  let owner: SignerWithAddress, attacker: SignerWithAddress | Wallet;
  let createOracle: (price: string) => Promise<MockOracle>;
  let BASE: string, QUOTE: string;
  let mockOracle: MockOracle;

  // Use beforeEach to set up the context for each test
  beforeEach(async () => {
    // THIS IS THE CRITICAL FIX:
    // Check the network name.
    if (network.name === "hardhat" || network.name === "localhost") {
      // If local, use the fast snapshot-based fixture.
      const fixtureData = await loadFixture(deployAggregatorFixture);
      aggregator = fixtureData.aggregator;
      owner = fixtureData.owner;
      attacker = fixtureData.attacker;
      createOracle = fixtureData.createOracle;
      BASE = fixtureData.BASE;
      QUOTE = fixtureData.QUOTE;
      mockOracle = fixtureData.mockOracle;
    } else {
      // If on a live network (like scrollSepolia), run the setup manually.
      // This will be slower but will work correctly.
      const setupData = await deployAggregatorFixture();
      aggregator = setupData.aggregator;
      owner = setupData.owner;
      attacker = setupData.attacker;
      createOracle = setupData.createOracle;
      BASE = setupData.BASE;
      QUOTE = setupData.QUOTE;
      mockOracle = setupData.mockOracle;
    }
  });

  describe("Access Control", () => {
    it("should prevent non-owners from adding an oracle", async () => {
      await expect(
        aggregator.connect(attacker).addOracle(BASE, QUOTE, await mockOracle.getAddress()),
      ).to.be.revertedWithCustomError(aggregator, "OwnableUnauthorizedAccount");
    });

    it("should prevent non-owners from removing an oracle", async () => {
      await aggregator.connect(owner).addOracle(BASE, QUOTE, await mockOracle.getAddress());
      await expect(aggregator.connect(attacker).removeOracle(BASE, QUOTE, 0)).to.be.revertedWithCustomError(
        aggregator,
        "OwnableUnauthorizedAccount",
      );
    });

    it("should prevent non-owners from setting max deviation", async () => {
      await expect(aggregator.connect(attacker).setMaxDeviationBps(1000)).to.be.revertedWithCustomError(
        aggregator,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("Oracle management", () => {
    it("adds an oracle", async () => {
      await expect(aggregator.connect(owner).addOracle(BASE, QUOTE, await mockOracle.getAddress()))
        .to.emit(aggregator, "OracleAdded")
        .withArgs(BASE, QUOTE, await mockOracle.getAddress());

      const list = await aggregator.getOracles(BASE, QUOTE);
      expect(list.length).to.equal(1);
      expect(list[0].oracleAddress).to.equal(await mockOracle.getAddress());
      expect(list[0].enabled).to.equal(true);
    });

    it("rejects duplicates", async () => {
      await aggregator.connect(owner).addOracle(BASE, QUOTE, await mockOracle.getAddress());
      await expect(aggregator.addOracle(BASE, QUOTE, await mockOracle.getAddress())).to.be.revertedWithCustomError(
        aggregator,
        "DuplicateOracle",
      );
    });

    it("toggles oracle", async () => {
      await aggregator.connect(owner).addOracle(BASE, QUOTE, await mockOracle.getAddress());

      await expect(aggregator.toggleOracle(BASE, QUOTE, 0, false))
        .to.emit(aggregator, "OracleToggled")
        .withArgs(BASE, QUOTE, 0, false);

      const list = await aggregator.getOracles(BASE, QUOTE);
      expect(list[0].enabled).to.equal(false);
    });

    it("removes oracle", async () => {
      await aggregator.connect(owner).addOracle(BASE, QUOTE, await mockOracle.getAddress());

      await expect(aggregator.removeOracle(BASE, QUOTE, 0))
        .to.emit(aggregator, "OracleRemoved")
        .withArgs(BASE, QUOTE, 0);
    });

    it("updates oracle", async () => {
      await aggregator.connect(owner).addOracle(BASE, QUOTE, await mockOracle.getAddress());

      const o1 = await createOracle("1.5");

      await expect(aggregator.updateOracle(BASE, QUOTE, 0, o1))
        .to.emit(aggregator, "OracleUpdated")
        .withArgs(BASE, QUOTE, 0, await mockOracle.getAddress(), await o1.getAddress());
    });

    it("removes an oracle and updates state", async () => {
      const o1 = await createOracle("1.0");
      const o2 = await createOracle("1.1");
      await aggregator.addOracle(BASE, QUOTE, await o1.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o2.getAddress());

      // Remove the first oracle (at index 0)
      await aggregator.removeOracle(BASE, QUOTE, 0);

      const list = await aggregator.getOracles(BASE, QUOTE);
      expect(list.length).to.equal(1);
      // The oracle at index 0 should now be what was originally at index 1
      expect(list[0].oracleAddress).to.equal(await o2.getAddress());
    });

    it("should revert when removing with an out-of-bounds index", async () => {
      await aggregator.addOracle(BASE, QUOTE, await mockOracle.getAddress());
      // Try to remove at index 1 when the length is only 1
      await expect(aggregator.removeOracle(BASE, QUOTE, 1)).to.be.revertedWithCustomError(aggregator, "InvalidIndex");
    });
  });

  describe("Quote functions", () => {
    it("returns average quote", async () => {
      const o1 = await createOracle("1.00");
      const o2 = await createOracle("1.10");

      await aggregator.addOracle(BASE, QUOTE, await o1.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o2.getAddress());

      const result = await aggregator.computeQuoteAverage(parseUnits("1", 18), BASE, QUOTE);
      expect(result).to.equal(parseUnits("1.05", 18));
    });

    it("returns median quote with an even number of oracles", async () => {
      const o1 = await createOracle("1.00");
      const o2 = await createOracle("1.01");
      const o3 = await createOracle("1.02");
      const o4 = await createOracle("1.03");

      await aggregator.addOracle(BASE, QUOTE, await o1.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o2.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o3.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o4.getAddress());

      // Sorted: [1.0, 1.1, 1.2, 1.3]. Median picks arr[4/2] = arr[2], which is 1.2
      const result = await aggregator.computeQuoteMedian(parseUnits("1", 18), BASE, QUOTE);
      expect(result).to.equal(parseUnits("1.02", 18));
    });

    it("ignores disabled oracles in calculation", async () => {
      const o1 = await createOracle("1.0"); // Will be disabled
      const o2 = await createOracle("2.5"); // Should be the only one used

      await aggregator.addOracle(BASE, QUOTE, await o1.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o2.getAddress());

      // Disable the first oracle
      await aggregator.toggleOracle(BASE, QUOTE, 0, false);

      const result = await aggregator.computeQuoteAverage(parseUnits("1", 18), BASE, QUOTE);
      expect(result).to.equal(parseUnits("2.5", 18)); // Average should only be from o2
    });

    it("returns median quote with 3 oracles", async () => {
      const o1 = await createOracle("1.0");
      const o2 = await createOracle("1.02");
      const o3 = await createOracle("1.05");

      await aggregator.addOracle(BASE, QUOTE, await o1.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o2.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o3.getAddress());

      const result = await aggregator.computeQuoteMedian(parseUnits("1", 18), BASE, QUOTE);
      expect(result).to.equal(BigInt("1020000000000000000"));
    });

    it("reverts on high deviation", async () => {
      await aggregator.setMaxDeviationBps(500); // 5%

      const o1 = await createOracle("1.0");
      const o2 = await createOracle("1.2"); // More than 5% deviation from 1.1, deviation > 9%

      await aggregator.addOracle(BASE, QUOTE, await o1.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o2.getAddress());

      await expect(aggregator.getQuoteAverage(parseUnits("1", 18), BASE, QUOTE)).to.be.revertedWithCustomError(
        aggregator,
        "DeviationTooHigh",
      );
    });

    it("reverts with 'no data' if all oracles revert", async () => {
      const o1 = await createOracle("1.0");
      await o1.setRevert(true);
      await aggregator.addOracle(BASE, QUOTE, await o1.getAddress());

      await expect(aggregator.getQuoteAverage(parseUnits("1", 18), BASE, QUOTE)).to.be.revertedWithCustomError(
        aggregator,
        "NoData",
      );
    });
  });

  describe("Upgradeability", () => {
    it("should allow the owner to upgrade the contract", async () => {
      // Deploy a V2 implementation
      const V2Factory = await ethers.getContractFactory("MultiOracleAggregatorV2"); // You would need to create this mock V2 contract
      const upgraded = (await upgrades.upgradeProxy(await aggregator.getAddress(), V2Factory, {
        call: { fn: "initializeV2" },
        unsafeAllow: ["missing-initializer"],
      })) as MultiOracleAggregatorV2;

      // Check if a new function from V2 exists
      expect(await upgraded.version()).to.equal("V2");

      // Check if state is preserved
      const ownerAfterUpgrade = await upgraded.owner();
      expect(ownerAfterUpgrade).to.equal(owner.address);
    });
  });
});
