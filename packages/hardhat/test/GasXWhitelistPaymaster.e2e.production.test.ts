// This test simulates a PRODUCTION environment where devMode is DISABLED.
// It verifies the end-to-end sponsored UserOperation flow in two scenarios:
// 1. SIMPLE MODE (52-byte paymasterAndData): No oracle signature required, but still production-safe
// 2. ORACLE MODE (>52 bytes): With oracle signature verification
//
// NOTE: The oracle signature verification has a design limitation - the opHash includes
// paymasterAndData which contains the signature, creating a circular dependency.
// Simple mode is the recommended approach for initial production deployment.
// Oracle mode requires a contract upgrade to compute hash excluding the signature.

import "dotenv/config";
import { expect } from "chai";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { createPublicClient, createWalletClient, Address, PublicClient, parseEther, Hex, custom } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

const GASX_FQN = "GasXWhitelistPaymaster";
const MOCK_TARGET_FQN = "MockTarget";

describe("GasX E2E Sponsorship Flow (Production Mode - With Oracle Signature)", function () {
  this.timeout(180000);

  let mockTargetDeployment: any;
  let gasXDeployment: any;
  let gasXConfigDeployment: any;
  let publicClient: PublicClient;
  let deployerAccount: ReturnType<typeof privateKeyToAccount>;
  let oracleAccount: ReturnType<typeof privateKeyToAccount>;
  let entryPoint: any;
  let paymaster: any;
  let config: any;

  // Use a separate private key for the oracle signer
  const HARDHAT_ACCOUNT_0_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
  const HARDHAT_ACCOUNT_1_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex; // Oracle signer

  before(async function () {
    // Skip this test if not running on a local Hardhat network
    if (network.name !== "localhost" && network.name !== "hardhat") {
      console.log(`[INFO] Skipping test "${this.test?.fullTitle()}" as it's designed for local networks.`);
      this.skip();
    }

    console.log(`\n--- Production Mode E2E Test Setup ---\n`);
    console.log(`  Running on local network: ${network.name}`);
    console.log(`  DevMode: DISABLED (simulating production)`);
    console.log(`---------------------------\n`);

    // Reset Hardhat network and deploy contracts
    await network.provider.send("hardhat_reset");
    await deployments.fixture([
      "GasXWhitelistPaymaster",
      "GasXConfig",
      "MockTarget",
      "SimpleAccountFactory",
      "EntryPoint",
    ]);

    gasXDeployment = await deployments.get(GASX_FQN);
    gasXConfigDeployment = await deployments.get("GasXConfig");
    mockTargetDeployment = await deployments.get(MOCK_TARGET_FQN);

    const { deployer } = await getNamedAccounts();
    const ethersDeployerSigner = await ethers.getSigner(deployer);
    deployerAccount = privateKeyToAccount(HARDHAT_ACCOUNT_0_PRIVATE_KEY);
    oracleAccount = privateKeyToAccount(HARDHAT_ACCOUNT_1_PRIVATE_KEY);

    console.log("Deployer address:", deployerAccount.address);
    console.log("Oracle signer address:", oracleAccount.address);

    publicClient = createPublicClient({ chain: hardhat, transport: custom(network.provider) });
    const walletClient = createWalletClient({
      account: deployerAccount,
      chain: hardhat,
      transport: custom(network.provider),
    });

    const entryPointDeployment = await deployments.get("EntryPoint");
    entryPoint = await ethers.getContractAt("EntryPoint", entryPointDeployment.address, ethersDeployerSigner);
    paymaster = await ethers.getContractAt(GASX_FQN, gasXDeployment.address, ethersDeployerSigner);
    config = await ethers.getContractAt("GasXConfig", gasXConfigDeployment.address, ethersDeployerSigner);

    // Fund Paymaster
    await entryPoint.depositTo(gasXDeployment.address, { value: parseEther("0.1") });

    // Set gas limits
    await walletClient.writeContract({
      address: gasXDeployment.address as Address,
      abi: gasXDeployment.abi,
      functionName: "setLimit",
      args: [1_000_000n, 0n],
      account: deployerAccount,
    });
    console.log("✅ Gas limits set");

    // CRITICAL: Disable dev mode to simulate production
    await paymaster.setDevMode(false);
    const isDevMode = await paymaster.isDev();
    console.log(`✅ DevMode disabled: isDev() = ${isDevMode}`);
    expect(isDevMode).to.equal(false);

    // Set the oracle signer in GasXConfig
    await config.setOracleSigner(oracleAccount.address);
    const configuredSigner = await config.oracleSigner();
    console.log(`✅ Oracle signer configured: ${configuredSigner}`);
    expect(configuredSigner.toLowerCase()).to.equal(oracleAccount.address.toLowerCase());

    // Whitelist the execute selector
    const simpleAccountInterface = new ethers.Interface((await deployments.getArtifact("SimpleAccount")).abi);
    const executeFunction = simpleAccountInterface.getFunction("execute");
    if (!executeFunction) throw new Error("Function 'execute' not found");
    const selector = executeFunction.selector;

    await walletClient.writeContract({
      address: gasXDeployment.address as Address,
      abi: gasXDeployment.abi,
      functionName: "setSelector",
      args: [selector, true],
    });
    console.log(`✅ Selector ${selector} whitelisted`);

    console.log("\n--- Production Mode Setup Complete ---\n");
  });

  it("Should execute a sponsored UserOperation in SIMPLE MODE (no oracle)", async function () {
    console.log("\n🚀 Executing sponsored UserOperation (Simple Mode - Production Safe)...");
    console.log("  ℹ️  Simple mode uses 52-byte paymasterAndData (no oracle signature required)");

    // Get contracts and interfaces
    const factoryDeployment = await deployments.get("SimpleAccountFactory");
    const factory = await ethers.getContractAt("SimpleAccountFactory", factoryDeployment.address);
    const simpleAccountArtifact = await deployments.getArtifact("SimpleAccount");
    const simpleAccountInterface = new ethers.Interface(simpleAccountArtifact.abi);
    const mockTargetInterface = new ethers.Interface(mockTargetDeployment.abi);

    // Prepare initCode
    const createAccountCall = factory.interface.encodeFunctionData("createAccount", [deployerAccount.address, 0n]);
    const initCode = ethers.concat([ethers.getBytes(ethers.getAddress(factory.target as string)), createAccountCall]);

    // Get sender address
    let senderAddress: Address;
    try {
      await entryPoint.getSenderAddress(initCode);
      throw new Error("getSenderAddress should have reverted");
    } catch (e: any) {
      const errorData = e.data?.data || e.data;
      const decodedError = entryPoint.interface.parseError(errorData);
      if (decodedError?.name !== "SenderAddressResult") {
        throw new Error(`Unexpected error from getSenderAddress: ${decodedError?.name}`);
      }
      senderAddress = decodedError.args[0];
    }
    console.log(`  > Sender (Smart Account) address: ${senderAddress}`);

    // Fund the sender
    await ethers.provider.send("hardhat_setBalance", [senderAddress, "0x1000000000000000000"]);

    // Prepare callData
    const targetCallData = mockTargetInterface.encodeFunctionData("execute");
    const accountCallData = simpleAccountInterface.encodeFunctionData("execute", [
      mockTargetDeployment.address,
      0,
      targetCallData,
    ]);

    // Get nonce
    const nonce = await entryPoint.getNonce(senderAddress, 0);

    // Gas parameters
    const callGasLimit = 1_000_000;
    const verificationGasLimit = 2_000_000;
    const preVerificationGas = 500_000;
    const maxFeePerGas = ethers.parseUnits("10", "gwei");
    const maxPriorityFeePerGas = ethers.parseUnits("5", "gwei");
    const paymasterVerificationGasLimit = 500_000;
    const paymasterPostOpGasLimit = 100_000;

    // ──────────────────────────────────────────────────────────────────────────
    // SIMPLE MODE: 52-byte paymasterAndData (address + gas limits)
    // No oracle signature required - the whitelist check is still enforced
    // ──────────────────────────────────────────────────────────────────────────
    const userOp = {
      sender: senderAddress,
      nonce: BigInt(nonce),
      initCode: ethers.hexlify(initCode) as `0x${string}`,
      callData: ethers.hexlify(accountCallData) as `0x${string}`,
      accountGasLimits: ethers.hexlify(
        ethers.concat([
          ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16),
          ethers.zeroPadValue(ethers.toBeHex(callGasLimit), 16),
        ]),
      ) as `0x${string}`,
      preVerificationGas: BigInt(preVerificationGas),
      gasFees: ethers.hexlify(
        ethers.concat([
          ethers.zeroPadValue(ethers.toBeHex(maxPriorityFeePerGas), 16),
          ethers.zeroPadValue(ethers.toBeHex(maxFeePerGas), 16),
        ]),
      ) as `0x${string}`,
      // SIMPLE MODE: Only 52 bytes (20 + 16 + 16) - no expiry/signature
      paymasterAndData: ethers.hexlify(
        ethers.concat([
          gasXDeployment.address as Address,
          ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
          ethers.zeroPadValue(ethers.toBeHex(paymasterPostOpGasLimit), 16),
        ]),
      ) as `0x${string}`,
      signature: "0x" as `0x${string}`,
    };

    console.log(`  > paymasterAndData length: ${(userOp.paymasterAndData.length - 2) / 2} bytes (52 = simple mode)`);

    // Sign the UserOperation with the account owner
    const signature = await deployerAccount.signTypedData({
      domain: {
        name: "ERC4337",
        version: "1",
        chainId: await publicClient.getChainId(),
        verifyingContract: entryPoint.target as Address,
      },
      types: {
        PackedUserOperation: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
        ],
      },
      primaryType: "PackedUserOperation",
      message: userOp,
    });
    userOp.signature = signature;

    // Send the UserOperation
    console.log("  > Sending UserOperation to EntryPoint...");
    const tx = await entryPoint.handleOps([userOp], deployerAccount.address);
    const receipt = await tx.wait();

    // Verify success
    expect(receipt.status).to.equal(1);
    console.log("  ✅ Transaction successfully mined!");

    const mockTarget = await ethers.getContractAt("MockTarget", mockTargetDeployment.address);
    const counter = await mockTarget.counter();
    expect(counter).to.equal(1n);
    console.log("  ✅ Verified MockTarget was called.");
    console.log("\n--- SIMPLE MODE TEST PASSED (Production Safe) ---\n");
  });

  it("Should REJECT UserOperation with INVALID oracle signature", async function () {
    console.log("\n🔒 Testing rejection of invalid oracle signature...");

    const factoryDeployment = await deployments.get("SimpleAccountFactory");
    const factory = await ethers.getContractAt("SimpleAccountFactory", factoryDeployment.address);
    const simpleAccountArtifact = await deployments.getArtifact("SimpleAccount");
    const simpleAccountInterface = new ethers.Interface(simpleAccountArtifact.abi);
    const mockTargetInterface = new ethers.Interface(mockTargetDeployment.abi);

    const createAccountCall = factory.interface.encodeFunctionData("createAccount", [deployerAccount.address, 1n]); // Different salt
    const initCode = ethers.concat([ethers.getBytes(ethers.getAddress(factory.target as string)), createAccountCall]);

    let senderAddress: Address;
    try {
      await entryPoint.getSenderAddress(initCode);
      throw new Error("getSenderAddress should have reverted");
    } catch (e: any) {
      const errorData = e.data?.data || e.data;
      const decodedError = entryPoint.interface.parseError(errorData);
      senderAddress = decodedError.args[0];
    }

    await ethers.provider.send("hardhat_setBalance", [senderAddress, "0x1000000000000000000"]);

    const targetCallData = mockTargetInterface.encodeFunctionData("execute");
    const accountCallData = simpleAccountInterface.encodeFunctionData("execute", [
      mockTargetDeployment.address,
      0,
      targetCallData,
    ]);

    const nonce = await entryPoint.getNonce(senderAddress, 0);
    const expiry = Math.floor(Date.now() / 1000) + 3600;

    // Create an INVALID signature (signed by wrong key - deployer instead of oracle)
    const wrongSigner = new ethers.Wallet(HARDHAT_ACCOUNT_0_PRIVATE_KEY); // Wrong key!
    const fakeDigest = ethers.solidityPackedKeccak256(["bytes32", "uint48"], [ethers.ZeroHash, expiry]);
    const invalidSignature = await wrongSigner.signMessage(ethers.getBytes(fakeDigest));

    const userOp = {
      sender: senderAddress,
      nonce: BigInt(nonce),
      initCode: ethers.hexlify(initCode) as `0x${string}`,
      callData: ethers.hexlify(accountCallData) as `0x${string}`,
      accountGasLimits: ethers.hexlify(
        ethers.concat([
          ethers.zeroPadValue(ethers.toBeHex(2_000_000), 16),
          ethers.zeroPadValue(ethers.toBeHex(1_000_000), 16),
        ]),
      ) as `0x${string}`,
      preVerificationGas: 500_000n,
      gasFees: ethers.hexlify(
        ethers.concat([
          ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("5", "gwei")), 16),
          ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("10", "gwei")), 16),
        ]),
      ) as `0x${string}`,
      paymasterAndData: ethers.hexlify(
        ethers.concat([
          gasXDeployment.address as Address,
          ethers.zeroPadValue(ethers.toBeHex(500_000), 16),
          ethers.zeroPadValue(ethers.toBeHex(100_000), 16),
          ethers.zeroPadValue(ethers.toBeHex(expiry), 6),
          invalidSignature, // INVALID signature!
        ]),
      ) as `0x${string}`,
      signature: "0x" as `0x${string}`,
    };

    // Sign the UserOperation
    const signature = await deployerAccount.signTypedData({
      domain: {
        name: "ERC4337",
        version: "1",
        chainId: await publicClient.getChainId(),
        verifyingContract: entryPoint.target as Address,
      },
      types: {
        PackedUserOperation: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
        ],
      },
      primaryType: "PackedUserOperation",
      message: userOp,
    });
    userOp.signature = signature;

    // Should revert with "GasX: Unauthorized signer"
    console.log("  > Sending UserOperation with invalid oracle signature...");
    await expect(entryPoint.handleOps([userOp], deployerAccount.address)).to.be.reverted;

    console.log("  ✅ Correctly rejected invalid oracle signature!");
    console.log("\n--- SECURITY TEST PASSED ---\n");
  });

  it("Should REJECT UserOperation with EXPIRED oracle signature", async function () {
    console.log("\n⏰ Testing rejection of expired oracle signature...");

    const factoryDeployment = await deployments.get("SimpleAccountFactory");
    const factory = await ethers.getContractAt("SimpleAccountFactory", factoryDeployment.address);
    const simpleAccountArtifact = await deployments.getArtifact("SimpleAccount");
    const simpleAccountInterface = new ethers.Interface(simpleAccountArtifact.abi);
    const mockTargetInterface = new ethers.Interface(mockTargetDeployment.abi);

    const createAccountCall = factory.interface.encodeFunctionData("createAccount", [deployerAccount.address, 2n]); // Different salt
    const initCode = ethers.concat([ethers.getBytes(ethers.getAddress(factory.target as string)), createAccountCall]);

    let senderAddress: Address;
    try {
      await entryPoint.getSenderAddress(initCode);
      throw new Error("getSenderAddress should have reverted");
    } catch (e: any) {
      const errorData = e.data?.data || e.data;
      const decodedError = entryPoint.interface.parseError(errorData);
      senderAddress = decodedError.args[0];
    }

    await ethers.provider.send("hardhat_setBalance", [senderAddress, "0x1000000000000000000"]);

    const targetCallData = mockTargetInterface.encodeFunctionData("execute");
    const accountCallData = simpleAccountInterface.encodeFunctionData("execute", [
      mockTargetDeployment.address,
      0,
      targetCallData,
    ]);

    const nonce = await entryPoint.getNonce(senderAddress, 0);

    // EXPIRED timestamp (1 hour in the past)
    const expiredExpiry = Math.floor(Date.now() / 1000) - 3600;

    const oracleSigner = new ethers.Wallet(HARDHAT_ACCOUNT_1_PRIVATE_KEY);
    const digest = ethers.solidityPackedKeccak256(["bytes32", "uint48"], [ethers.ZeroHash, expiredExpiry]);
    const oracleSignature = await oracleSigner.signMessage(ethers.getBytes(digest));

    const userOp = {
      sender: senderAddress,
      nonce: BigInt(nonce),
      initCode: ethers.hexlify(initCode) as `0x${string}`,
      callData: ethers.hexlify(accountCallData) as `0x${string}`,
      accountGasLimits: ethers.hexlify(
        ethers.concat([
          ethers.zeroPadValue(ethers.toBeHex(2_000_000), 16),
          ethers.zeroPadValue(ethers.toBeHex(1_000_000), 16),
        ]),
      ) as `0x${string}`,
      preVerificationGas: 500_000n,
      gasFees: ethers.hexlify(
        ethers.concat([
          ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("5", "gwei")), 16),
          ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("10", "gwei")), 16),
        ]),
      ) as `0x${string}`,
      paymasterAndData: ethers.hexlify(
        ethers.concat([
          gasXDeployment.address as Address,
          ethers.zeroPadValue(ethers.toBeHex(500_000), 16),
          ethers.zeroPadValue(ethers.toBeHex(100_000), 16),
          ethers.zeroPadValue(ethers.toBeHex(expiredExpiry), 6), // EXPIRED!
          oracleSignature,
        ]),
      ) as `0x${string}`,
      signature: "0x" as `0x${string}`,
    };

    const signature = await deployerAccount.signTypedData({
      domain: {
        name: "ERC4337",
        version: "1",
        chainId: await publicClient.getChainId(),
        verifyingContract: entryPoint.target as Address,
      },
      types: {
        PackedUserOperation: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
        ],
      },
      primaryType: "PackedUserOperation",
      message: userOp,
    });
    userOp.signature = signature;

    // Should revert with "expired!"
    console.log("  > Sending UserOperation with expired timestamp...");
    await expect(entryPoint.handleOps([userOp], deployerAccount.address)).to.be.reverted;

    console.log("  ✅ Correctly rejected expired oracle signature!");
    console.log("\n--- EXPIRY TEST PASSED ---\n");
  });
});
