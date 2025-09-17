// This test is specifically designed to verify the functionality of the `createE2ELocalSmartAccount` helper.
// It ensures that the helper correctly creates a SmartAccount-like object with methods expected by SmartAccountClient.

import { expect } from "chai";
import { deployments, network } from "hardhat";
import { createPublicClient, custom, Address, Hex, encodeFunctionData, PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts"; // Correct import for privateKeyToAccount
import { hardhat } from "viem/chains";
import { createE2ELocalSmartAccount } from "../helpers/e2eLocalSmartAccount";
import { SimpleAccountFactory__factory } from "../typechain-types";

describe("E2ELocalSmartAccount Helper Functionality", () => {
  let publicClient: PublicClient;
  let ownerAccount: ReturnType<typeof privateKeyToAccount>;
  let entryPointAddress: Address;
  let simpleAccountFactoryAddress: Address;

  before(async function () {
    // Skip this test if not running on a local Hardhat network
    if (network.name !== "localhost" && network.name !== "hardhat") {
      console.log(`[INFO] Skipping test "${this.test?.fullTitle()}" as it's designed for local networks.`);
      this.skip();
    }

    console.log(
      `\n--- Helper Test Setup Complete ---\n  Running on local network: ${network.name}\n----------------------------------\n`,
    );

    // Reset Hardhat network and deploy contracts
    await network.provider.send("hardhat_reset");
    await deployments.fixture(["EntryPoint", "SimpleAccountFactory"]);

    const entryPointDeployment = await deployments.get("EntryPoint");
    const factoryDeployment = await deployments.get("SimpleAccountFactory");

    entryPointAddress = entryPointDeployment.address as Address;
    simpleAccountFactoryAddress = factoryDeployment.address as Address;

    // Hardcode the default Hardhat private key for local testing
    ownerAccount = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex);

    publicClient = createPublicClient({
      chain: hardhat,
      transport: custom(network.provider),
    });
  });

  it("should create a SmartAccount-like object with expected properties and methods", async function () {
    this.timeout(60000);

    const smartAccount = await createE2ELocalSmartAccount(
      publicClient,
      ownerAccount,
      entryPointAddress,
      simpleAccountFactoryAddress,
    );

    // Verify basic properties
    expect(smartAccount).to.have.property("address").that.is.a("string").to.not.equal(undefined);
    expect(smartAccount.address).to.not.equal("0x");

    // Verify encodeCalls method
    expect(smartAccount).to.have.property("encodeCalls").that.is.a("function");
    const dummyCallData = encodeFunctionData({
      abi: SimpleAccountFactory__factory.abi,
      functionName: "createAccount",
      args: [ownerAccount.address, 0n],
    });
    const encodedCalls = await smartAccount.encodeCalls([{ to: ownerAccount.address, data: dummyCallData }]);
    expect(encodedCalls).to.be.a("string").to.not.equal(undefined);
    expect(encodedCalls).to.equal(dummyCallData); // Expecting it to return the data for now

    // Verify getFactoryArgs method
    expect(smartAccount).to.have.property("getFactoryArgs").that.is.a("function");
    const factoryArgs = smartAccount.getFactoryArgs();
    expect(factoryArgs).to.be.an("array").with.lengthOf(2);
    expect(factoryArgs[0]).to.equal(simpleAccountFactoryAddress);
    expect(factoryArgs[1]).to.be.a("string").to.not.equal(undefined);

    console.log(`[TEST] Helper created Smart Account Address: ${smartAccount.address}`);
  });
});
