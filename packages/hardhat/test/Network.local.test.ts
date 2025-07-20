// This test is designed for local Hardhat networks (localhost, hardhat).
// It verifies the deployment and basic functionality of the 'GasX' contract in a local environment.

import { expect } from "chai";
import { deployments, network } from "hardhat";
import { createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";

describe("Network Local Test - GasX Deployment", function () {
  let gasXDeployment: any; // Using 'any' for simplicity, consider defining a proper type
  let publicClient: ReturnType<typeof createPublicClient>;

  before(async function () {
    const networkName = network.name;
    if (networkName !== "localhost" && networkName !== "hardhat") {
      this.skip(); // Skip if not on a local network
    }

    console.log(`\n--- Test Setup Complete ---`);
    console.log(`  Running on local network: ${networkName}`);
    console.log(`---------------------------\n`);

    await deployments.fixture(["GasX"]);
    gasXDeployment = await deployments.get("GasX");

    publicClient = createPublicClient({ chain: hardhat, transport: http() });
  });

  it("Should correctly load GasX deployment and verify its bytecode", async function () {
    expect(gasXDeployment).to.not.equal(undefined);
    expect(gasXDeployment.address).to.be.a("string");
    console.log(`  > Successfully loaded 'GasX' deployment at address: ${gasXDeployment.address}`);

    const bytecode = await publicClient.getCode({ address: gasXDeployment.address as `0x${string}` });
    expect(bytecode).to.not.equal(undefined);
    expect(bytecode).to.not.equal("0x");
    console.log(`  > Bytecode found for 'GasX' on ${network.name}.`);
  });
});
