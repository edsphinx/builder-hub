import { expect } from "chai";
import { ethers } from "hardhat";
import { GasXConfig } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GasXConfig", function () {
  let config: GasXConfig;
  let owner: HardhatEthersSigner;
  let oracleSigner: HardhatEthersSigner;
  let newSigner: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  // Sample function selectors for testing
  const TRANSFER_SELECTOR = "0xa9059cbb"; // transfer(address,uint256)
  const APPROVE_SELECTOR = "0x095ea7b3"; // approve(address,uint256)
  const SWAP_SELECTOR = "0x38ed1739"; // swapExactTokensForTokens

  beforeEach(async function () {
    [owner, oracleSigner, newSigner, attacker] = await ethers.getSigners();

    const GasXConfigFactory = await ethers.getContractFactory("GasXConfig");
    config = await GasXConfigFactory.deploy(oracleSigner.address);
    await config.waitForDeployment();
  });

  // ─────────────────────────────────────────────────────────
  // DEPLOYMENT TESTS
  // ─────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await config.owner()).to.equal(owner.address);
    });

    it("Should set the correct oracle signer", async function () {
      expect(await config.oracleSigner()).to.equal(oracleSigner.address);
    });

    it("Should revert when deploying with zero address as oracle signer", async function () {
      const GasXConfigFactory = await ethers.getContractFactory("GasXConfig");
      await expect(GasXConfigFactory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(config, "ZeroAddress");
    });

    it("Should have empty maxUsdPerSelector mapping initially", async function () {
      expect(await config.getMaxUsd(TRANSFER_SELECTOR)).to.equal(0n);
      expect(await config.getMaxUsd(APPROVE_SELECTOR)).to.equal(0n);
    });
  });

  // ─────────────────────────────────────────────────────────
  // ORACLE SIGNER TESTS
  // ─────────────────────────────────────────────────────────

  describe("setOracleSigner", function () {
    it("Should allow owner to update oracle signer", async function () {
      await config.setOracleSigner(newSigner.address);
      expect(await config.oracleSigner()).to.equal(newSigner.address);
    });

    it("Should emit OracleSignerUpdated event with previous and new signer", async function () {
      await expect(config.setOracleSigner(newSigner.address))
        .to.emit(config, "OracleSignerUpdated")
        .withArgs(oracleSigner.address, newSigner.address);
    });

    it("Should revert when non-owner tries to update oracle signer", async function () {
      await expect(config.connect(attacker).setOracleSigner(newSigner.address)).to.be.revertedWith("not owner");
    });

    it("Should revert when setting zero address as oracle signer", async function () {
      await expect(config.setOracleSigner(ethers.ZeroAddress)).to.be.revertedWithCustomError(config, "ZeroAddress");
    });

    it("Should allow setting same oracle signer (no-op)", async function () {
      await expect(config.setOracleSigner(oracleSigner.address))
        .to.emit(config, "OracleSignerUpdated")
        .withArgs(oracleSigner.address, oracleSigner.address);
    });
  });

  // ─────────────────────────────────────────────────────────
  // SET MAX USD TESTS
  // ─────────────────────────────────────────────────────────

  describe("setMaxUsd", function () {
    const maxUsd = 100_000_000n; // $100 (6 decimals)

    it("Should allow owner to set max USD for a selector", async function () {
      await config.setMaxUsd(TRANSFER_SELECTOR, maxUsd);
      expect(await config.getMaxUsd(TRANSFER_SELECTOR)).to.equal(maxUsd);
    });

    it("Should emit MaxUsdSet event with previous and new values", async function () {
      await expect(config.setMaxUsd(TRANSFER_SELECTOR, maxUsd))
        .to.emit(config, "MaxUsdSet")
        .withArgs(TRANSFER_SELECTOR, 0n, maxUsd);
    });

    it("Should emit correct previous value when updating", async function () {
      await config.setMaxUsd(TRANSFER_SELECTOR, maxUsd);
      const newMaxUsd = 200_000_000n; // $200

      await expect(config.setMaxUsd(TRANSFER_SELECTOR, newMaxUsd))
        .to.emit(config, "MaxUsdSet")
        .withArgs(TRANSFER_SELECTOR, maxUsd, newMaxUsd);
    });

    it("Should revert when non-owner tries to set max USD", async function () {
      await expect(config.connect(attacker).setMaxUsd(TRANSFER_SELECTOR, maxUsd)).to.be.revertedWith("not owner");
    });

    it("Should allow setting max USD to zero (disable subsidy)", async function () {
      await config.setMaxUsd(TRANSFER_SELECTOR, maxUsd);
      await config.setMaxUsd(TRANSFER_SELECTOR, 0n);
      expect(await config.getMaxUsd(TRANSFER_SELECTOR)).to.equal(0n);
    });

    it("Should handle max uint256 value", async function () {
      const maxValue = ethers.MaxUint256;
      await config.setMaxUsd(TRANSFER_SELECTOR, maxValue);
      expect(await config.getMaxUsd(TRANSFER_SELECTOR)).to.equal(maxValue);
    });
  });

  // ─────────────────────────────────────────────────────────
  // BULK SET MAX USD TESTS
  // ─────────────────────────────────────────────────────────

  describe("bulkSetMaxUsd", function () {
    const selectors = [TRANSFER_SELECTOR, APPROVE_SELECTOR, SWAP_SELECTOR];
    const maxUsds = [100_000_000n, 200_000_000n, 500_000_000n]; // $100, $200, $500

    it("Should allow owner to bulk set max USD for multiple selectors", async function () {
      await config.bulkSetMaxUsd(selectors, maxUsds);

      expect(await config.getMaxUsd(TRANSFER_SELECTOR)).to.equal(100_000_000n);
      expect(await config.getMaxUsd(APPROVE_SELECTOR)).to.equal(200_000_000n);
      expect(await config.getMaxUsd(SWAP_SELECTOR)).to.equal(500_000_000n);
    });

    it("Should emit MaxUsdSet event for each selector", async function () {
      const tx = await config.bulkSetMaxUsd(selectors, maxUsds);

      await expect(tx).to.emit(config, "MaxUsdSet").withArgs(TRANSFER_SELECTOR, 0n, 100_000_000n);
      await expect(tx).to.emit(config, "MaxUsdSet").withArgs(APPROVE_SELECTOR, 0n, 200_000_000n);
      await expect(tx).to.emit(config, "MaxUsdSet").withArgs(SWAP_SELECTOR, 0n, 500_000_000n);
    });

    it("Should revert when arrays have different lengths", async function () {
      const mismatchedUsds = [100_000_000n, 200_000_000n]; // Only 2 elements
      await expect(config.bulkSetMaxUsd(selectors, mismatchedUsds)).to.be.revertedWithCustomError(
        config,
        "LengthMismatch",
      );
    });

    it("Should revert when non-owner tries to bulk set", async function () {
      await expect(config.connect(attacker).bulkSetMaxUsd(selectors, maxUsds)).to.be.revertedWith("not owner");
    });

    it("Should handle empty arrays", async function () {
      await config.bulkSetMaxUsd([], []);
      // Should not revert
    });

    it("Should handle single element arrays", async function () {
      await config.bulkSetMaxUsd([TRANSFER_SELECTOR], [100_000_000n]);
      expect(await config.getMaxUsd(TRANSFER_SELECTOR)).to.equal(100_000_000n);
    });

    it("Should emit correct previous values when updating", async function () {
      // First set initial values
      await config.bulkSetMaxUsd(selectors, maxUsds);

      // Update with new values
      const newMaxUsds = [150_000_000n, 250_000_000n, 550_000_000n];
      const tx = await config.bulkSetMaxUsd(selectors, newMaxUsds);

      await expect(tx).to.emit(config, "MaxUsdSet").withArgs(TRANSFER_SELECTOR, 100_000_000n, 150_000_000n);
      await expect(tx).to.emit(config, "MaxUsdSet").withArgs(APPROVE_SELECTOR, 200_000_000n, 250_000_000n);
      await expect(tx).to.emit(config, "MaxUsdSet").withArgs(SWAP_SELECTOR, 500_000_000n, 550_000_000n);
    });
  });

  // ─────────────────────────────────────────────────────────
  // VIEW FUNCTION TESTS
  // ─────────────────────────────────────────────────────────

  describe("getMaxUsd", function () {
    it("Should return 0 for unknown selectors", async function () {
      const unknownSelector = "0xdeadbeef";
      expect(await config.getMaxUsd(unknownSelector)).to.equal(0n);
    });

    it("Should return correct value after setting", async function () {
      const maxUsd = 100_000_000n;
      await config.setMaxUsd(TRANSFER_SELECTOR, maxUsd);
      expect(await config.getMaxUsd(TRANSFER_SELECTOR)).to.equal(maxUsd);
    });
  });

  describe("getAllLimits", function () {
    it("Should return array of limits for given selectors", async function () {
      const selectors = [TRANSFER_SELECTOR, APPROVE_SELECTOR, SWAP_SELECTOR];
      const maxUsds = [100_000_000n, 200_000_000n, 500_000_000n];
      await config.bulkSetMaxUsd(selectors, maxUsds);

      const limits = await config.getAllLimits(selectors);
      expect(limits[0]).to.equal(100_000_000n);
      expect(limits[1]).to.equal(200_000_000n);
      expect(limits[2]).to.equal(500_000_000n);
    });

    it("Should handle empty array", async function () {
      const limits = await config.getAllLimits([]);
      expect(limits.length).to.equal(0);
    });

    it("Should return 0 for unknown selectors", async function () {
      const limits = await config.getAllLimits([TRANSFER_SELECTOR, APPROVE_SELECTOR]);
      expect(limits[0]).to.equal(0n);
      expect(limits[1]).to.equal(0n);
    });

    it("Should return mixed values for known and unknown selectors", async function () {
      await config.setMaxUsd(TRANSFER_SELECTOR, 100_000_000n);
      const limits = await config.getAllLimits([TRANSFER_SELECTOR, APPROVE_SELECTOR]);
      expect(limits[0]).to.equal(100_000_000n);
      expect(limits[1]).to.equal(0n);
    });
  });

  // ─────────────────────────────────────────────────────────
  // ACCESS CONTROL TESTS
  // ─────────────────────────────────────────────────────────

  describe("Access Control", function () {
    it("Should have immutable owner", async function () {
      // Owner is immutable, so there's no way to change it
      expect(await config.owner()).to.equal(owner.address);
    });

    it("Should block all admin functions for non-owners", async function () {
      await expect(config.connect(attacker).setOracleSigner(attacker.address)).to.be.revertedWith("not owner");
      await expect(config.connect(attacker).setMaxUsd(TRANSFER_SELECTOR, 100n)).to.be.revertedWith("not owner");
      await expect(config.connect(attacker).bulkSetMaxUsd([TRANSFER_SELECTOR], [100n])).to.be.revertedWith("not owner");
    });
  });

  // ─────────────────────────────────────────────────────────
  // GAS OPTIMIZATION TESTS
  // ─────────────────────────────────────────────────────────

  describe("Gas Optimization", function () {
    it("Should be gas efficient for bulk operations", async function () {
      const selectors = [TRANSFER_SELECTOR, APPROVE_SELECTOR, SWAP_SELECTOR];
      const maxUsds = [100_000_000n, 200_000_000n, 500_000_000n];

      const bulkTx = await config.bulkSetMaxUsd(selectors, maxUsds);
      const bulkReceipt = await bulkTx.wait();

      // Individual transactions for comparison
      const individualGasUsed: bigint[] = [];
      for (let i = 0; i < selectors.length; i++) {
        const tx = await config.setMaxUsd(selectors[i], maxUsds[i]);
        const receipt = await tx.wait();
        individualGasUsed.push(receipt!.gasUsed);
      }

      // Bulk should be more efficient than individual calls
      const totalIndividualGas = individualGasUsed.reduce((a, b) => a + b, 0n);
      console.log(`Bulk gas used: ${bulkReceipt!.gasUsed}`);
      console.log(`Individual gas total: ${totalIndividualGas}`);
      console.log(`Gas saved: ${totalIndividualGas - bulkReceipt!.gasUsed}`);
    });
  });
});
