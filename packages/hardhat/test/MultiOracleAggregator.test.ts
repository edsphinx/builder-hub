import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { MultiOracleAggregator, MockOracle } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { parseUnits } from "ethers";

describe("MultiOracleAggregator", () => {
  let owner: SignerWithAddress;
  let aggregator: MultiOracleAggregator;
  let mockOracle: MockOracle;

  const BASE = "0x0000000000000000000000000000000000000001";
  const QUOTE = "0x0000000000000000000000000000000000000002";

  beforeEach(async () => {
    [owner] = await ethers.getSigners();

    const AggregatorFactory = await ethers.getContractFactory("MultiOracleAggregator");
    const trustedForwarder = ethers.ZeroAddress;
    aggregator = (await upgrades.deployProxy(AggregatorFactory, [owner.address, 500, trustedForwarder], {
      kind: "uups",
    })) as MultiOracleAggregator;

    const OracleFactory = await ethers.getContractFactory("MockOracle");
    mockOracle = (await OracleFactory.deploy(parseUnits("1", 18))) as MockOracle;
    await mockOracle.waitForDeployment();
  });

  describe("Oracle management", () => {
    it("adds an oracle", async () => {
      const oracleAddr = await mockOracle.getAddress();
      await expect(aggregator.addOracle(BASE, QUOTE, oracleAddr))
        .to.emit(aggregator, "OracleAdded")
        .withArgs(BASE, QUOTE, oracleAddr);

      const list = await aggregator.getOracles(BASE, QUOTE);
      expect(list.length).to.equal(1);
      expect(list[0].oracleAddress).to.equal(oracleAddr);
      expect(list[0].enabled).to.equal(true);
    });

    it("rejects duplicates", async () => {
      const oracleAddr = await mockOracle.getAddress();
      await aggregator.addOracle(BASE, QUOTE, oracleAddr);
      await expect(aggregator.addOracle(BASE, QUOTE, oracleAddr)).to.be.revertedWith("duplicate");
    });

    it("toggles oracle", async () => {
      const oracleAddr = await mockOracle.getAddress();
      await aggregator.addOracle(BASE, QUOTE, oracleAddr);

      await expect(aggregator.toggleOracle(BASE, QUOTE, 0, false))
        .to.emit(aggregator, "OracleToggled")
        .withArgs(BASE, QUOTE, 0, false);

      const list = await aggregator.getOracles(BASE, QUOTE);
      expect(list[0].enabled).to.equal(false);
    });

    it("removes oracle", async () => {
      const oracleAddr = await mockOracle.getAddress();
      await aggregator.addOracle(BASE, QUOTE, oracleAddr);

      await expect(aggregator.removeOracle(BASE, QUOTE, 0))
        .to.emit(aggregator, "OracleRemoved")
        .withArgs(BASE, QUOTE, 0);
    });

    it("updates oracle", async () => {
      const oracleAddr1 = await mockOracle.getAddress();
      await aggregator.addOracle(BASE, QUOTE, oracleAddr1);

      const newOracleFactory = await ethers.getContractFactory("MockOracle");
      const newOracle = (await newOracleFactory.deploy(parseUnits("1.5", 18))) as MockOracle;
      await newOracle.waitForDeployment();
      const oracleAddr2 = await newOracle.getAddress();

      await expect(aggregator.updateOracle(BASE, QUOTE, 0, oracleAddr2))
        .to.emit(aggregator, "OracleUpdated")
        .withArgs(BASE, QUOTE, 0, oracleAddr1, oracleAddr2);
    });
  });

  describe("Quote functions", () => {
    it("returns average quote", async () => {
      const OracleFactory = await ethers.getContractFactory("MockOracle");

      const o1 = (await OracleFactory.deploy(parseUnits("1.00", 18))) as MockOracle;
      const o2 = (await OracleFactory.deploy(parseUnits("1.10", 18))) as MockOracle;

      await aggregator.addOracle(BASE, QUOTE, await o1.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o2.getAddress());

      const result = await aggregator.computeQuoteAverage(parseUnits("1", 18), BASE, QUOTE);
      expect(result).to.equal(parseUnits("1.05", 18));
    });

    it("returns median quote with 3 oracles", async () => {
      const OracleFactory = await ethers.getContractFactory("MockOracle");

      const o1 = (await OracleFactory.deploy(parseUnits("1", 18))) as MockOracle;
      const o2 = (await OracleFactory.deploy(parseUnits("1.02", 18))) as MockOracle;
      const o3 = (await OracleFactory.deploy(parseUnits("1.05", 18))) as MockOracle;

      await aggregator.addOracle(BASE, QUOTE, await o1.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o2.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o3.getAddress());

      const result = await aggregator.computeQuoteMedian(parseUnits("1", 18), BASE, QUOTE);
      expect(result).to.equal(BigInt("1020000000000000000"));
    });

    it("reverts on high deviation", async () => {
      const OracleFactory = await ethers.getContractFactory("MockOracle");

      const o1 = (await OracleFactory.deploy(parseUnits("1", 18))) as MockOracle;
      const o2 = (await OracleFactory.deploy(parseUnits("4", 18))) as MockOracle;

      await aggregator.addOracle(BASE, QUOTE, await o1.getAddress());
      await aggregator.addOracle(BASE, QUOTE, await o2.getAddress());

      await expect(aggregator.getQuoteAverage(parseUnits("1", 18), BASE, QUOTE)).to.be.revertedWith(
        "deviation too high",
      );
    });

    it("ignores oracles marked to revert", async () => {
      await mockOracle.setRevert(true);
      await aggregator.addOracle(BASE, QUOTE, await mockOracle.getAddress());

      await expect(aggregator.getQuoteAverage(parseUnits("1", 18), BASE, QUOTE)).to.be.revertedWith("no data");
    });
  });
});
