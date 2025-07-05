// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { parseEther, toHex } from "viem/utils";
// import { abi as aggregatorAbi } from "../artifacts/contracts/MultiOracleAggregator.sol/MultiOracleAggregator.json";
// import { abi as oracleAbi } from "../artifacts/contracts/mocks/MockOracle.sol/MockOracle.json";

// const forwarder = "0x0000000000000000000000000000000000000001"; // dummy

// let aggregator: any;
// let oracle1: any;
// let oracle2: any;
// let deployer: any;
// let base: string;
// let quote: string;

// test.beforeAll(async () => {
//   deployer = (await walletClient.getAddresses())[0];

//   oracle1 = await deployContract("MockOracle", [1e18]); // returns 1.0
//   oracle2 = await deployContract("MockOracle", [2e18]); // returns 2.0

//   aggregator = await deployContract("MultiOracleAggregator", [forwarder]);
//   await aggregator.write.initialize([deployer, 1000]); // max deviation = 10%

//   base = "0x1111111111111111111111111111111111111111";
//   quote = "0x2222222222222222222222222222222222222222";
// });

// test("addOracle adds unique oracles", async () => {
//   await aggregator.write.addOracle([base, quote, oracle1.address]);
//   await aggregator.write.addOracle([base, quote, oracle2.address]);
//   const oracles = await aggregator.read.getOracles([base, quote]);
//   expect(oracles.length).toBe(2);
//   expect(oracles[0].oracle).toBe(oracle1.address);
// });

// test("addOracle rejects duplicates", async () => {
//   await expect(
//     aggregator.write.addOracle([base, quote, oracle1.address])
//   ).rejects.toThrowError("duplicate");
// });

// test("updateOracle replaces existing oracle", async () => {
//   const oracle3 = await deployContract("MockOracle", [3e18]);
//   await aggregator.write.updateOracle([base, quote, 1, oracle3.address]);
//   const oracles = await aggregator.read.getOracles([base, quote]);
//   expect(oracles[1].oracle).toBe(oracle3.address);
// });

// test("toggleOracle disables and re-enables", async () => {
//   await aggregator.write.toggleOracle([base, quote, 1, false]);
//   const afterDisable = await aggregator.read.getOracles([base, quote]);
//   expect(afterDisable[1].enabled).toBe(false);
//   await aggregator.write.toggleOracle([base, quote, 1, true]);
//   const afterEnable = await aggregator.read.getOracles([base, quote]);
//   expect(afterEnable[1].enabled).toBe(true);
// });

// test("getQuoteAverage returns correct average", async () => {
//   const avg = await aggregator.read.getQuoteAverage([parseEther("1"), base, quote]);
//   expect(avg).toBe("2000000000000000000"); // (1e18 + 3e18) / 2
// });

// test("getQuoteMedian returns correct median", async () => {
//   const med = await aggregator.read.getQuoteMedian([parseEther("1"), base, quote]);
//   expect(med).toBe("2000000000000000000"); // sorted: [1e18, 3e18] ⇒ median is 3e18 if 2 elements: mid
// });

// test("quote rejected if deviation exceeds max", async () => {
//   const outlier = await deployContract("MockOracle", [10e18]);
//   await aggregator.write.addOracle([base, quote, outlier.address]);
//   await aggregator.write.setMaxDeviationBps([500]); // 5%
//   await expect(
//     aggregator.read.getQuoteAverage([parseEther("1"), base, quote])
//   ).rejects.toThrowError("dev too high");
// });

// test("removeOracle removes by index", async () => {
//   const before = await aggregator.read.getOracles([base, quote]);
//   const lenBefore = before.length;
//   await aggregator.write.removeOracle([base, quote, 2]);
//   const after = await aggregator.read.getOracles([base, quote]);
//   expect(after.length).toBe(lenBefore - 1);
// });
// import { ethers } from "hardhat";
// import { expect } from "chai";
// import { MultiOracleAggregator, MockOracle } from "../typechain-types";
// import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// describe("MultiOracleAggregator", () => {
//   let owner: SignerWithAddress;
//   let user: SignerWithAddress;
//   let aggregator: MultiOracleAggregator;
//   let mockOracle: MockOracle;

//   const BASE = "0x0000000000000000000000000000000000000001";
//   const QUOTE = "0x0000000000000000000000000000000000000002";

//   beforeEach(async () => {
//     [owner, user] = await ethers.getSigners();

//     const AggregatorFactory = await ethers.getContractFactory("MultiOracleAggregator");
//     aggregator = (await AggregatorFactory.deploy(owner.address, 500)) as MultiOracleAggregator;

//     const OracleFactory = await ethers.getContractFactory("MockOracle");
//     mockOracle = (await OracleFactory.deploy()) as MockOracle;
//   });

//   describe("Oracle management", () => {
//     it("should add a new oracle", async () => {
//       await expect(aggregator.addOracle(BASE, QUOTE, await mockOracle.getAddress()))
//         .to.emit(aggregator, "OracleAdded")
//         .withArgs(BASE, QUOTE, await mockOracle.getAddress());

//       const list = await aggregator.getOracles(BASE, QUOTE);
//       expect(list.length).to.equal(1);
//       expect(list[0].oracle).to.equal(await mockOracle.getAddress());
//       expect(list[0].enabled).to.be.true;
//     });

//     it("should reject duplicate oracle", async () => {
//       await aggregator.addOracle(BASE, QUOTE, await mockOracle.getAddress());
//       await expect(aggregator.addOracle(BASE, QUOTE, await mockOracle.getAddress())).to.be.revertedWith("duplicate");
//     });

//     it("should toggle oracle", async () => {
//       await aggregator.addOracle(BASE, QUOTE, await mockOracle.getAddress());
//       await expect(aggregator.toggleOracle(BASE, QUOTE, 0, false))
//         .to.emit(aggregator, "OracleToggled")
//         .withArgs(BASE, QUOTE, 0, false);

//       const list = await aggregator.getOracles(BASE, QUOTE);
//       expect(list[0].enabled).to.be.false;
//     });

//     it("should remove oracle", async () => {
//       await aggregator.addOracle(BASE, QUOTE, await mockOracle.getAddress());
//       await expect(aggregator.removeOracle(BASE, QUOTE, 0))
//         .to.emit(aggregator, "OracleRemoved")
//         .withArgs(BASE, QUOTE, 0);
//     });

//     it("should update oracle", async () => {
//       const newOracle = await (await (await ethers.getContractFactory("MockOracle")).deploy()).getAddress();
//       await aggregator.addOracle(BASE, QUOTE, await mockOracle.getAddress());
//       await expect(aggregator.updateOracle(BASE, QUOTE, 0, newOracle))
//         .to.emit(aggregator, "OracleUpdated")
//         .withArgs(BASE, QUOTE, 0, await mockOracle.getAddress(), newOracle);
//     });
//   });

//   describe("Quote behavior", () => {
//     beforeEach(async () => {
//       await aggregator.addOracle(BASE, QUOTE, await mockOracle.getAddress());
//     });

//     it("should return average quote", async () => {
//       await mockOracle.setQuote(ethers.parseUnits("1", 18));
//       const quote = await aggregator.getQuoteAverage(ethers.parseUnits("1", 18), BASE, QUOTE);
//       expect(quote).to.equal(ethers.parseUnits("1", 18));
//     });

//     it("should return median quote", async () => {
//       await mockOracle.setQuote(ethers.parseUnits("1", 18));
//       const quote = await aggregator.getQuoteMedian(ethers.parseUnits("1", 18), BASE, QUOTE);
//       expect(quote).to.equal(ethers.parseUnits("1", 18));
//     });

//     it("should reject if deviation too high", async () => {
//       const oracle2 = await (await (await ethers.getContractFactory("MockOracle")).deploy()).getAddress();

//       await aggregator.addOracle(BASE, QUOTE, oracle2);
//       const mock2 = await ethers.getContractAt("MockOracle", oracle2);

//       await mockOracle.setQuote(ethers.parseUnits("1", 18)); // 1
//       await mock2.setQuote(ethers.parseUnits("3", 18));       // 3 -> 200% deviation

//       await expect(
//         aggregator.getQuoteAverage(ethers.parseUnits("1", 18), BASE, QUOTE)
//       ).to.be.revertedWith("dev too high");
//     });
//   });
// });
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
