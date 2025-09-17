import { ethers } from "hardhat";
import { assert, expect } from "chai";
import {
  EntryPoint,
  EntryPoint__factory,
  GasXConfig,
  GasXConfig__factory,
  TestableGasX,
  TestableGasX__factory,
} from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GasXWhitelistPaymaster", () => {
  let deployer: SignerWithAddress;
  let entryPoint: EntryPoint;
  let paymaster: TestableGasX;

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

  let oracle: SignerWithAddress;
  let config: GasXConfig;

  beforeEach(async () => {
    [deployer, oracle] = (await ethers.getSigners()) as [SignerWithAddress, SignerWithAddress];

    // Deploy a fresh EntryPoint
    const epFactory = (await ethers.getContractFactory(
      "@account-abstraction/contracts/core/EntryPoint.sol:EntryPoint",
    )) as EntryPoint__factory;
    entryPoint = await epFactory.deploy();
    await entryPoint.waitForDeployment();

    // Deploy GasXConfig
    const configFactory = (await ethers.getContractFactory("GasXConfig")) as GasXConfig__factory;
    config = await configFactory.deploy(oracle.address);
    await config.waitForDeployment();

    // Deploy TestableGasX
    const pmFactory = (await ethers.getContractFactory("TestableGasX")) as TestableGasX__factory;
    paymaster = await pmFactory.deploy(await entryPoint.getAddress(), await config.getAddress(), deployer.address);
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
      await expect(paymaster.exposedValidate(op as any, ethers.ZeroHash, 0n)).to.be.revertedWith(
        "GasX: Disallowed function",
      );
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
      await expect(paymaster.exposedValidate(op as any, ethers.ZeroHash, 0n)).to.be.revertedWith(
        "GasX: Gas limit exceeded",
      );
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
      await expect(paymaster.exposedValidate(op as any, ethers.ZeroHash, 0n)).to.be.revertedWith(
        "GasX: Gas limit exceeded",
      );
    });
  });

  describe("4. Oracle expiry validation", () => {
    it("rejects expired oracle data", async () => {
      const sel = ethers.zeroPadValue("0x1234", 4);
      await paymaster.setSelector(sel, true);

      const block = await ethers.provider.getBlock("latest");
      const expiry = BigInt(block!.timestamp - 10); // timestamp pasado

      // Pack: [20B paymaster][16B validationGas][16B postOpGas][6B expiry][65B sig]
      const pack = ethers.concat([
        ethers.zeroPadValue(await paymaster.getAddress(), 20),
        ethers.zeroPadValue(ethers.toBeHex(0), 16), // dummy validationGas
        ethers.zeroPadValue(ethers.toBeHex(0), 16), // dummy postOpGas
        ethers.zeroPadValue(ethers.toBeHex(expiry), 6), // 6-byte expiry
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

      // Pack: [20B paymaster][16B validationGas][16B postOpGas][6B expiry][65B sig]
      const pack = ethers.concat([
        ethers.zeroPadValue(await paymaster.getAddress(), 20),
        ethers.zeroPadValue(ethers.toBeHex(0), 16), // dummy validationGas
        ethers.zeroPadValue(ethers.toBeHex(0), 16), // dummy postOpGas
        ethers.zeroPadValue(ethers.toBeHex(expiry), 6), // 6-byte expiry
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

  describe("7. Oracle Signature Verification", () => {
    it("should accept a valid signature when dev mode is off", async () => {
      await paymaster.setDevMode(false);
      const sel = ethers.zeroPadValue("0x1234", 4);
      await paymaster.setSelector(sel, true);

      const block = await ethers.provider.getBlock("latest");
      const expiry = BigInt(block!.timestamp + 60);

      const opHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      // const digest = ethers.solidityPackedKeccak256(["bytes32", "uint256"], [opHash, expiry]);
      const digest = ethers.solidityPackedKeccak256(["bytes32", "uint48"], [opHash, expiry]);
      const signature = await oracle.signMessage(ethers.getBytes(digest));

      const pack = ethers.concat([
        ethers.zeroPadValue(await paymaster.getAddress(), 20),
        ethers.zeroPadValue(ethers.toBeHex(0), 16),
        ethers.zeroPadValue(ethers.toBeHex(0), 16),
        ethers.zeroPadValue(ethers.toBeHex(expiry), 6),
        signature,
      ]);

      const op = {
        ...opTemplate,
        sender: deployer,
        callData: sel + "dead",
        paymasterAndData: pack,
      };

      const [, vd] = await paymaster.exposedValidate(op as any, opHash, 0n);
      assert.equal(vd, 0n, "Should accept valid signature");
    });

    it("should reject an invalid signature when dev mode is off", async () => {
      await paymaster.setDevMode(false);
      const sel = ethers.zeroPadValue("0x1234", 4);
      await paymaster.setSelector(sel, true);

      const block = await ethers.provider.getBlock("latest");
      const expiry = BigInt(block!.timestamp + 60);

      const opHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const signature = await deployer.signMessage(ethers.getBytes(opHash)); // Signed by wrong signer

      const pack = ethers.concat([
        ethers.zeroPadValue(await paymaster.getAddress(), 20),
        ethers.zeroPadValue(ethers.toBeHex(0), 16),
        ethers.zeroPadValue(ethers.toBeHex(0), 16),
        ethers.zeroPadValue(ethers.toBeHex(expiry), 6),
        signature,
      ]);

      const op = {
        ...opTemplate,
        sender: deployer,
        callData: sel + "dead",
        paymasterAndData: pack,
      };

      await expect(paymaster.exposedValidate(op as any, opHash, 0n)).to.be.revertedWith("GasX: Unauthorized signer");
    });

    it("should bypass signature validation when dev mode is on", async () => {
      await paymaster.setDevMode(true);
      const sel = ethers.zeroPadValue("0x1234", 4);
      await paymaster.setSelector(sel, true);

      const block = await ethers.provider.getBlock("latest");
      const expiry = BigInt(block!.timestamp + 60);

      const opHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const signature = await deployer.signMessage(ethers.getBytes(opHash)); // Signed by wrong signer

      const pack = ethers.concat([
        ethers.zeroPadValue(await paymaster.getAddress(), 20),
        ethers.zeroPadValue(ethers.toBeHex(0), 16),
        ethers.zeroPadValue(ethers.toBeHex(0), 16),
        ethers.zeroPadValue(ethers.toBeHex(expiry), 6),
        signature,
      ]);

      const op = {
        ...opTemplate,
        sender: deployer,
        callData: sel + "dead",
        paymasterAndData: pack,
      };

      const [, vd] = await paymaster.exposedValidate(op as any, opHash, 0n);
      assert.equal(vd, 0n, "Should bypass signature validation in dev mode");
    });
  });

  // Last set of tests
  describe("GasXConfig", () => {
    // `config` y `deployer` ya están definidos en el `beforeEach` principal,
    // por lo que podemos usarlos directamente aquí.

    it("should deploy with the correct owner and initial oracle signer", async () => {
      // Verifica que el owner del contrato es quien lo desplegó
      const contractOwner = await config.owner();
      assert.equal(contractOwner, deployer.address, "Owner should be the deployer");

      // Verifica que el oracleSigner inicial es el correcto
      const initialSigner = await config.oracleSigner();
      assert.equal(initialSigner, oracle.address, "Initial oracle signer is incorrect");
    });

    it("should allow the owner to update the oracle signer", async () => {
      const [, newSigner] = await ethers.getSigners();

      // El owner cambia el signer
      await expect(config.connect(deployer).setOracleSigner(newSigner.address))
        .to.emit(config, "OracleUpdated")
        .withArgs(newSigner.address);

      // Verifica que la dirección se actualizó correctamente
      const updatedSigner = await config.oracleSigner();
      assert.equal(updatedSigner, newSigner.address, "Oracle signer should be updated");
    });

    it("should prevent non-owners from updating configuration", async () => {
      const [, attacker, newSigner] = await ethers.getSigners();
      const sel = "0x12345678";

      // Un atacante no puede cambiar el oracle signer
      await expect(config.connect(attacker).setOracleSigner(newSigner.address)).to.be.revertedWith("not owner");

      // Un atacante no puede establecer límites de USD
      await expect(config.connect(attacker).setMaxUsd(sel, 100)).to.be.revertedWith("not owner");

      await expect(config.connect(attacker).bulkSetMaxUsd([sel], [100])).to.be.revertedWith("not owner");
    });

    it("should allow the owner to set and get max USD for a selector", async () => {
      const selector = "0xabcdef12";
      const limit = ethers.parseUnits("10.5", 6); // 10.5 USD con 6 decimales

      // Establece el límite
      await expect(config.setMaxUsd(selector, limit)).to.emit(config, "MaxUsdSet").withArgs(selector, limit);

      // Verifica el límite usando la función de vista individual
      const retrievedLimit = await config.getMaxUsd(selector);
      assert.equal(retrievedLimit.toString(), limit.toString(), "Max USD should be set correctly");
    });

    it("should allow the owner to bulk-set max USD limits", async () => {
      const selectors = ["0x11111111", "0x22222222", "0x33333333"];
      const limits = [
        ethers.parseUnits("5", 6), // 5 USD
        ethers.parseUnits("20", 6), // 20 USD
        ethers.parseUnits("0.1", 6), // 0.1 USD
      ];

      await config.bulkSetMaxUsd(selectors, limits);

      // Verifica los límites usando la función de vista múltiple
      const retrievedLimits = await config.getAllLimits(selectors);
      assert.deepEqual(
        retrievedLimits.map((l: { toString: () => any }) => l.toString()),
        limits.map(l => l.toString()),
        "Bulk-set limits should match",
      );

      // Verifica uno de los límites individualmente también
      const singleLimit = await config.getMaxUsd("0x22222222");
      assert.equal(singleLimit.toString(), limits[1].toString(), "Individual limit after bulk set is incorrect");
    });

    it("should revert bulk-set if array lengths mismatch", async () => {
      const selectors = ["0x11111111"];
      const limits = [ethers.parseUnits("1", 6), ethers.parseUnits("2", 6)];

      await expect(config.bulkSetMaxUsd(selectors, limits)).to.be.revertedWith("length mismatch");
    });
  });
});
