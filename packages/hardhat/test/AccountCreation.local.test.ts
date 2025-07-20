// This test demonstrates the creation of a smart account.
// It uses a conditional approach:
// - For local Hardhat networks, it directly interacts with the deployed SimpleAccountFactory
//   to create the smart account, simulating the behavior of permissionless.
// - For public networks (testnet/mainnet), it uses the 'permissionless' library's
//   toSimpleSmartAccount function, which is designed for these environments.
// This ensures compatibility and proper testing across different network types.

import { expect } from "chai";
import { deployments, network } from "hardhat";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPublicClient, http, Address, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { createLocalSmartAccount } from "../helpers/localSmartAccount";
import { resolveEnvironment, Environment } from "../helpers/environment";

describe("Account Creation - Following Working Pattern", () => {
  it("should create a smart account by omitting the factoryAddress parameter", async function () {
    this.timeout(60000);

    // 1. Deploy contracts. The factory needs to be deployed at the default address
    // that permissionless will look for.
    await deployments.fixture(["EntryPoint", "SimpleAccountFactory"]);
    const entryPointDeployment = await deployments.get("EntryPoint");

    if (!("url" in network.config)) {
      throw new Error("La configuración de red de Hardhat no tiene una propiedad `url`.");
    }
    // 2. Create a PublicClient
    const publicClient = createPublicClient({
      chain: hardhat,
      transport: http((network.config as any).url),
    });

    // 3. Define the owner account
    const owner = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

    console.log(`\n[FINAL TEST] Using EntryPoint: ${entryPointDeployment.address}`);

    let smartAccount: { address: Address };
    const currentEnvironment = resolveEnvironment(network.name);

    // Get simpleAccountFactoryDeployment here, as it's needed for both branches
    const simpleAccountFactoryDeployment = await deployments.get("SimpleAccountFactory");

    if (currentEnvironment === Environment.Dev) {
      console.log("[FINAL TEST] Using local smart account creation for Hardhat network...");
      smartAccount = await createLocalSmartAccount(
        publicClient,
        owner,
        entryPointDeployment.address as Address,
        simpleAccountFactoryDeployment.address as Address,
      );
    } else {
      console.log("[FINAL TEST] Calling toSimpleSmartAccount WITHOUT factoryAddress (for public networks)...");
      smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: owner,
      });
    }

    console.log(`\n[FINAL TEST] Success! Smart Account Address: ${smartAccount.address}`);
    expect(isAddress(smartAccount.address)).to.equal(true);
  });
});
