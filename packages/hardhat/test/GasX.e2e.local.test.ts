// This test is designed for local Hardhat networks (localhost, hardhat).
// It verifies the end-to-end sponsored UserOperation flow for the GasX contract in a local environment.
// This test focuses on the contract's ability to process sponsored UserOperations directly via EntryPoint,
// without simulating a full bundler/paymaster interaction from permissionless.

import "dotenv/config";
import { expect } from "chai";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { createPublicClient, createWalletClient, http, Address, PublicClient, parseEther, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

describe("GasX E2E Sponsorship Flow (Local)", function () {
  this.timeout(180000);

  let mockTargetDeployment: any;
  let gasXDeployment: any;
  let publicClient: PublicClient;
  let deployerAccount: ReturnType<typeof privateKeyToAccount>;
  let entryPoint: any; // Ethers contract instance for EntryPoint

  before(async function () {
    // Skip this test if not running on a local Hardhat network
    if (network.name !== "localhost" && network.name !== "hardhat") {
      console.log(`[INFO] Skipping test "${this.test?.fullTitle()}" as it's designed for local networks.`);
      this.skip();
    }

    console.log(`\n--- Test Setup Complete ---\n`);
    console.log(`  Running on local network: ${network.name}`);
    console.log(`---------------------------\n`);

    // Reset Hardhat network and deploy contracts
    await network.provider.send("hardhat_reset");
    await deployments.fixture(["GasX", "MockTarget", "SimpleAccountFactory", "EntryPoint"]);

    gasXDeployment = await deployments.get("GasX");
    mockTargetDeployment = await deployments.get("MockTarget");
    // const factoryDeployment = await deployments.get("SimpleAccountFactory"); // Not directly used in this simplified flow

    // Define the owner account (default Hardhat account)
    const { deployer } = await getNamedAccounts();
    deployerAccount = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex);

    publicClient = createPublicClient({ chain: hardhat, transport: http() });
    const walletClient = createWalletClient({ account: deployerAccount, chain: hardhat, transport: http() });

    const entryPointDeployment = await deployments.get("EntryPoint");

    // Fund Paymaster
    const ethersDeployerSigner = await ethers.getSigner(deployer);
    entryPoint = await ethers.getContractAt("EntryPoint", entryPointDeployment.address, ethersDeployerSigner);
    await entryPoint.depositTo(gasXDeployment.address, { value: parseEther("0.1") });

    // Configure Paymaster limits and selectors
    await walletClient.writeContract({
      address: gasXDeployment.address as Address,
      abi: gasXDeployment.abi,
      functionName: "setLimit",
      args: [1_000_000, 0],
    });

    const simpleAccountInterface = new ethers.Interface((await deployments.getArtifact("SimpleAccount")).abi);
    const executeFunction = simpleAccountInterface.getFunction("execute");
    if (!executeFunction) {
      throw new Error("Function 'execute' not found in SimpleAccount ABI");
    }
    const selector = executeFunction.selector;

    await walletClient.writeContract({
      address: gasXDeployment.address as Address,
      abi: gasXDeployment.abi,
      functionName: "setSelector",
      args: [selector, true],
    });

    console.log("--- Test Setup Complete ---\n");
  });

  it("Should execute a sponsored UserOperation", async function () {
    console.log("\n🚀 Executing sponsored UserOperation...");

    // -------------------------------------------------------------------------------------
    // [1] GET CONTRACTS AND INTERFACES
    // We need the interfaces for encoding the function calls that will be part of the UserOp.
    // -------------------------------------------------------------------------------------
    const factoryDeployment = await deployments.get("SimpleAccountFactory");
    const factory = await ethers.getContractAt("SimpleAccountFactory", factoryDeployment.address);
    const simpleAccountArtifact = await deployments.getArtifact("SimpleAccount");
    const simpleAccountInterface = new ethers.Interface(simpleAccountArtifact.abi);
    const mockTargetInterface = new ethers.Interface(mockTargetDeployment.abi);

    // -------------------------------------------------------------------------------------
    // [2] PREPARE INITCODE
    // The initCode is the code that will be used to create the smart account if it does not exist yet.
    // It's a concatenation of the factory address and the calldata for the factory's `createAccount` function.
    // -------------------------------------------------------------------------------------
    const createAccountCall = factory.interface.encodeFunctionData("createAccount", [deployerAccount.address, 0n]);
    const initCode = ethers.concat([ethers.getBytes(ethers.getAddress(factory.target as string)), createAccountCall]);

    // -------------------------------------------------------------------------------------
    // [3] GET SENDER ADDRESS
    // The sender of the UserOperation is the smart account itself. Since the account may not exist yet,
    // we calculate its future address by calling `getSenderAddress` on the EntryPoint.
    // This function is designed to revert with the calculated address in the error data.
    // -------------------------------------------------------------------------------------
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
    console.log(`  > Calculated sender (Smart Account) address: ${senderAddress}`);

    // Fund the sender address for debugging. If sponsorship fails, it can pay for its own gas.
    await ethers.provider.send("hardhat_setBalance", [senderAddress, "0x1000000000000000000"]); // 1 ETH

    // -------------------------------------------------------------------------------------
    // [4] PREPARE CALLDATA
    // This is the actual operation the smart account will execute. We want our smart account
    // to call the `execute` function on the `MockTarget` contract.
    // -------------------------------------------------------------------------------------
    const targetCallData = mockTargetInterface.encodeFunctionData("execute");
    const accountCallData = simpleAccountInterface.encodeFunctionData("execute", [
      mockTargetDeployment.address,
      0,
      targetCallData,
    ]);

    // -------------------------------------------------------------------------------------
    // [5] GET NONCE
    // The nonce for a UserOperation is managed by the EntryPoint for each smart account.
    // -------------------------------------------------------------------------------------
    const nonce = await entryPoint.getNonce(senderAddress, 0);

    // -------------------------------------------------------------------------------------
    // [6] ASSEMBLE THE USEROPERATION
    // This is the core of the test. We construct the UserOperation object according to the
    // `PackedUserOperation` struct expected by EntryPoint v0.8.0.
    // -------------------------------------------------------------------------------------
    const callGasLimit = 1_000_000;
    const verificationGasLimit = 2_000_000;
    const preVerificationGas = 500_000;
    const maxFeePerGas = ethers.parseUnits("10", "gwei");
    const maxPriorityFeePerGas = ethers.parseUnits("5", "gwei");

    // These gas limits are for the paymaster's validation and post-op phases.
    const paymasterVerificationGasLimit = 500_000;
    const paymasterPostOpGasLimit = 100_000;

    const userOp = {
      sender: senderAddress,
      nonce: BigInt(nonce),
      initCode: ethers.hexlify(initCode) as `0x${string}`,
      callData: ethers.hexlify(accountCallData) as `0x${string}`,
      // EPv0.8 packs gas limits into a single bytes32 field.
      accountGasLimits: ethers.hexlify(
        ethers.concat([
          ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16),
          ethers.zeroPadValue(ethers.toBeHex(callGasLimit), 16),
        ]),
      ) as `0x${string}`,
      preVerificationGas: BigInt(preVerificationGas),
      // EPv0.8 also packs gas fees into a single bytes32 field.
      gasFees: ethers.hexlify(
        ethers.concat([
          ethers.zeroPadValue(ethers.toBeHex(maxPriorityFeePerGas), 16),
          ethers.zeroPadValue(ethers.toBeHex(maxFeePerGas), 16),
        ]),
      ) as `0x${string}`,
      // The paymasterAndData field must be at least 52 bytes long for EPv0.8.
      // It consists of the paymaster address (20 bytes), followed by gas limits (32 bytes).
      // Our GasX contract was updated to handle this structure correctly.
      paymasterAndData: ethers.hexlify(
        ethers.concat([
          gasXDeployment.address as Address,
          ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
          ethers.zeroPadValue(ethers.toBeHex(paymasterPostOpGasLimit), 16),
        ]),
      ) as `0x${string}`,
      signature: "0x", // Placeholder, will be replaced after signing.
    };

    // -------------------------------------------------------------------------------------
    // [7] SIGN THE USEROPERATION
    // The signature is the most critical part. We must sign the EIP-712 typed data hash of the
    // UserOperation, not the simple message hash. `signTypedData` handles this correctly.
    // Using `signMessage` would produce an invalid signature (AA24 error).
    // -------------------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------------------
    // [8] SEND THE USEROPERATION
    // We send the complete, signed UserOperation to the EntryPoint to be executed.
    // -------------------------------------------------------------------------------------
    console.log("  > Sending UserOperation to EntryPoint...");
    const tx = await entryPoint.handleOps([userOp], deployerAccount.address);
    const receipt = await tx.wait();

    // -------------------------------------------------------------------------------------
    // [9] ASSERT THE OUTCOME
    // The transaction should be successful, and we verify that the `counter` on our
    // MockTarget contract was incremented, proving the call was executed.
    // -------------------------------------------------------------------------------------
    expect(receipt.status).to.equal(1);
    console.log("  ✅ Transaction successfully mined!");

    const mockTarget = await ethers.getContractAt("MockTarget", mockTargetDeployment.address);
    const counter = await mockTarget.counter();
    expect(counter).to.equal(1n);
    console.log("  ✅ Verified MockTarget was called.");
    console.log("--- TEST END ---\n");
  });
});
