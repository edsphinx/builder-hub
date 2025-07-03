import { ethers } from "hardhat";
import { assert, expect } from "chai";
import { EntryPoint, EntryPoint__factory, TestableWalletFuel, TestableWalletFuel__factory } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("WalletFuel", () => {
  let deployer: SignerWithAddress;
  let entryPoint: EntryPoint;
  let paymaster: TestableWalletFuel;

  // Base template for UserOperation
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

  beforeEach(async () => {
    [deployer] = (await ethers.getSigners()) as SignerWithAddress[];

    // Deploy a fresh EntryPoint
    const epFactory = (await ethers.getContractFactory(
      "@account-abstraction/contracts/core/EntryPoint.sol:EntryPoint",
    )) as EntryPoint__factory;
    entryPoint = await epFactory.deploy();
    await entryPoint.waitForDeployment();

    // Deploy TestableWalletFuel
    const pmFactory = (await ethers.getContractFactory("TestableWalletFuel")) as TestableWalletFuel__factory;
    paymaster = await pmFactory.deploy(await entryPoint.getAddress(), deployer.address, deployer.address);
    await paymaster.waitForDeployment();

    // Set default gas limit
    await paymaster.setLimit(500, 0);
  });

  describe("1. Deployment & configuration", () => {
    it("should deploy with correct entryPoint", async () => {
      const epAddr = await entryPoint.getAddress();
      assert.equal(await paymaster.entryPoint(), epAddr, "Stored entryPoint address should match");
    });

    it("should restrict limit and whitelist updates to owner", async () => {
      const [, attacker] = await ethers.getSigners();

      // atacante no es owner
      await expect(paymaster.connect(attacker).setLimit(1, 0)).to.be.reverted;
      await expect(paymaster.connect(attacker).setSelector("0x00001234", true)).to.be.reverted;

      // el owner sí
      await paymaster.setLimit(1234, 0);
      const lims = await paymaster.limits();
      assert.equal(lims.maxGas, 1234n, "maxGas should update");

      await paymaster.setSelector("0x0000cafe", true);
      assert.isTrue(await paymaster.allowedSelectors("0x0000cafe"), "selector should be whitelisted");
    });
  });

  describe("2. Selector validation", () => {
    it("accepts a whitelisted selector", async () => {
      // Generamos un selector de 4 bytes a partir de "0x1234"
      const sel = ethers.zeroPadValue("0x1234", 4); // => "0x00001234"
      await paymaster.setSelector(sel, true);

      // clonamos el template y sustituimos sólo callData
      const op = {
        ...opTemplate,
        sender: deployer,
        callData: sel + "cafecafe",
      };

      // Llamamos al helper que expone internamente _validatePaymasterUserOp
      const [ctx, vd] = await paymaster.exposedValidate(op as any, ethers.ZeroHash, 0n);
      assert.equal(ctx, "0x", "Context should be empty");
      assert.equal(vd, 0n, "validationData should be zero");
    });

    it("rejects a non-whitelisted selector", async () => {
      const sel = ethers.zeroPadValue("0xdeadbeef", 4);
      const op = {
        ...opTemplate,
        sender: deployer,
        callData: sel + "dead",
      };
      await expect(paymaster.exposedValidate(op as any, ethers.ZeroHash, 0n)).to.be.revertedWith("func!");
    });

    it("allows toggling whitelist on and off", async () => {
      const sel = ethers.zeroPadValue("0x1111", 4);
      // estado inicial: false
      assert.isFalse(await paymaster.allowedSelectors(sel));
      // enciende
      await paymaster.setSelector(sel, true);
      assert.isTrue(await paymaster.allowedSelectors(sel));
      // apaga
      await paymaster.setSelector(sel, false);
      assert.isFalse(await paymaster.allowedSelectors(sel));
    });
  });

  describe("3. Gas limit enforcement", () => {
    it("accepts if gas equals limit", async () => {
      const sel = ethers.zeroPadValue("0x2222", 4);
      await paymaster.setSelector(sel, true);
      await paymaster.setLimit(1000, 0);
      const accountGasLimits = ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(0n), 16),
        ethers.zeroPadValue(ethers.toBeHex(1000n), 16),
      ]) as `0x${string}`;

      const op = {
        ...opTemplate,
        sender: deployer,
        callData: sel + "abcd",
        accountGasLimits,
      };
      const [, vd] = await paymaster.exposedValidate(op as any, ethers.ZeroHash, 0n);
      assert.equal(vd, 0n, "Should pass at exact gas limit");
    });

    it("rejects just above the gas limit", async () => {
      const sel = ethers.zeroPadValue("0x3333", 4);
      await paymaster.setSelector(sel, true);
      await paymaster.setLimit(1000, 0);

      const accountGasLimits = ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(0n), 16),
        ethers.zeroPadValue(ethers.toBeHex(1001n), 16),
      ]) as `0x${string}`;

      const op = {
        ...opTemplate,
        sender: deployer,
        callData: sel + "abcd",
        accountGasLimits,
      };
      await expect(paymaster.exposedValidate(op as any, ethers.ZeroHash, 0n)).to.be.revertedWith("gas!");
    });

    it("rejects gas above limit", async () => {
      const sel = ethers.zeroPadValue("0x12345678", 4);
      await paymaster.setSelector(sel, true);

      // empaqueta dos uint128 en 32 bytes: [verificationGasLimit(0), callGasLimit(1000)]
      const accountGasLimits = ethers.concat([
        // 16 bytes de ceros para verificationGasLimit
        ethers.zeroPadValue(ethers.toBeHex(0n), 16),
        // 16 bytes con 1000 para callGasLimit
        ethers.zeroPadValue(ethers.toBeHex(1000n), 16),
      ]) as `0x${string}`;

      const op = {
        ...opTemplate,
        sender: deployer,
        callData: sel + "cafecafe",
        accountGasLimits,
      };
      await expect(paymaster.exposedValidate(op as any, ethers.ZeroHash, 0n)).to.be.revertedWith("gas!");
    });
  });

  describe("4. Oracle expiry validation", () => {
    it("rejects expired oracle data", async () => {
      const sel = ethers.zeroPadValue("0x1234", 4);
      await paymaster.setSelector(sel, true);

      const block = await ethers.provider.getBlock("latest");
      const expiry = BigInt(block!.timestamp - 10); // timestamp pasado

      // Pack: [20B paymaster][12B expiry][65B sig]
      const pack = ethers.concat([
        ethers.zeroPadValue(await paymaster.getAddress(), 20),
        ethers.zeroPadValue(ethers.toBeHex(expiry), 12),
        ethers.randomBytes(65),
      ]);

      const op = {
        ...opTemplate,
        sender: deployer,
        callData: sel + "dead",
        paymasterAndData: pack,
      };
      await expect(paymaster.exposedValidate(op as any, ethers.ZeroHash, 0n)).to.be.revertedWith("expired!");
    });

    it("accepts future oracle expiry", async () => {
      const sel = ethers.zeroPadValue("0x4444", 4);
      await paymaster.setSelector(sel, true);

      const block = await ethers.provider.getBlock("latest");
      const expiry = BigInt(block!.timestamp + 60); // futuro

      const pack = ethers.concat([
        ethers.zeroPadValue(await paymaster.getAddress(), 20),
        ethers.zeroPadValue(ethers.toBeHex(expiry), 12),
        ethers.randomBytes(65),
      ]);

      const op = {
        ...opTemplate,
        sender: deployer,
        callData: sel + "abcd",
        paymasterAndData: pack,
      };
      const [, vd] = await paymaster.exposedValidate(op as any, ethers.ZeroHash, 0n);
      assert.equal(vd, 0n, "Future expiry should be accepted");
    });
  });

  describe("5. Full PackedUserOperation", () => {
    it("validates complete PackedUserOperation", async () => {
      const sel = ethers.zeroPadValue("0x5555", 4);
      await paymaster.setSelector(sel, true);
      await paymaster.setLimit(1000, 0);

      const accountGasLimits = ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(0n), 16),
        ethers.zeroPadValue(ethers.toBeHex(1000n), 16),
      ]) as `0x${string}`;

      const fullOp = {
        sender: deployer,
        nonce: 42n,
        initCode: "0xdead",
        callData: sel + "beef",
        accountGasLimits,
        preVerificationGas: 1n,
        gasFees: ethers.ZeroHash,
        paymasterAndData: "0x",
        signature: "0x01",
      };
      const [ctx, vd] = await paymaster.exposedValidate(fullOp as any, ethers.ZeroHash, 0n);
      assert.equal(vd, 0n, "validationData should be zero");
      assert.equal(ctx, "0x", "context should be empty");
    });
  });

  describe("6. Post-op behavior", () => {
    it("emits GasSponsored event via harness", async () => {
      const caller = await deployer.getAddress();
      await expect(paymaster.exposedPostOp("0x", 200n, 3n))
        .to.emit(paymaster, "GasSponsored")
        .withArgs(caller, 200n, 200n * 3n);
    });
  });
});
