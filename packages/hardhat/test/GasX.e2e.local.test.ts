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
    const selector = simpleAccountInterface.getFunction("execute").selector;

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

    // 1. Get contracts and interfaces
    const factoryDeployment = await deployments.get("SimpleAccountFactory");
    const factory = await ethers.getContractAt("SimpleAccountFactory", factoryDeployment.address);
    const simpleAccountArtifact = await deployments.getArtifact("SimpleAccount");
    const simpleAccountInterface = new ethers.Interface(simpleAccountArtifact.abi);
    const mockTargetInterface = new ethers.Interface(mockTargetDeployment.abi);

    // 2. Prepare initCode
    const createAccountCall = factory.interface.encodeFunctionData("createAccount", [deployerAccount.address, 0n]);
    const initCode = ethers.concat([factory.target, createAccountCall]);

    // 3. Get sender address
    let senderAddress: Address;
    try {
      await entryPoint.getSenderAddress(initCode);
      // This should not be reached, as getSenderAddress should revert.
      throw new Error("getSenderAddress should have reverted");
    } catch (e: any) {
      // We expect a revert, and the address is in the error data.
      const errorData = e.data?.data || e.data;
      const decodedError = entryPoint.interface.parseError(errorData);
      if (decodedError?.name !== "SenderAddressResult") {
        throw new Error(`Unexpected error from getSenderAddress: ${decodedError?.name}`);
      }
      senderAddress = decodedError.args[0];
    }
    console.log(`  > Calculated sender (Smart Account) address: ${senderAddress}`);

    // Fund the sender address so it can pay for gas if sponsorship fails during debug
    await ethers.provider.send("hardhat_setBalance", [
      senderAddress,
      "0x1000000000000000000", // 1 ETH
    ]);

    // 4. Prepare callData for the Smart Account
    const targetCallData = mockTargetInterface.encodeFunctionData("execute");
    const accountCallData = simpleAccountInterface.encodeFunctionData("execute", [
      mockTargetDeployment.address,
      0,
      targetCallData,
    ]);

    // 5. Get nonce
    const nonce = await entryPoint.getNonce(senderAddress, 0);

    // 6. Assemble the UserOperation
    const callGasLimit = 1_000_000;
    const verificationGasLimit = 2_000_000;
    const preVerificationGas = 500_000;
    const maxFeePerGas = ethers.parseUnits("10", "gwei");
    const maxPriorityFeePerGas = ethers.parseUnits("5", "gwei");

    const paymasterVerificationGasLimit = 500_000;
    const paymasterPostOpGasLimit = 100_000;

    const userOp = {
      sender: senderAddress,
      nonce: nonce,
      initCode: initCode,
      callData: accountCallData,
      accountGasLimits: ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(verificationGasLimit), 16),
        ethers.zeroPadValue(ethers.toBeHex(callGasLimit), 16),
      ]),
      preVerificationGas: preVerificationGas,
      gasFees: ethers.concat([
        ethers.zeroPadValue(ethers.toBeHex(maxPriorityFeePerGas), 16),
        ethers.zeroPadValue(ethers.toBeHex(maxFeePerGas), 16),
      ]),
      paymasterAndData: ethers.concat([
        gasXDeployment.address as Address,
        ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
        ethers.zeroPadValue(ethers.toBeHex(paymasterPostOpGasLimit), 16),
      ]),
      signature: "0x", // Placeholder
    };

    // 7. Sign the UserOperation
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

    // 9. Send the UserOperation
    console.log("  > Sending UserOperation to EntryPoint...");
    const tx = await entryPoint.handleOps([userOp], deployerAccount.address);
    const receipt = await tx.wait();

    // 10. Assert
    expect(receipt.status).to.equal(1);
    console.log("  ✅ Transaction successfully mined!");

    // Optional: Verify that the target contract was actually called
    const mockTarget = await ethers.getContractAt("MockTarget", mockTargetDeployment.address);
    const counter = await mockTarget.counter();
    expect(counter).to.equal(1n);
    console.log("  ✅ Verified MockTarget was called.");
    console.log("--- TEST END ---\n");
  });
});
