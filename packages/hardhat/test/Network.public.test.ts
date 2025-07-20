// This test is designed for public networks (e.g., Scroll Sepolia).
// It verifies the existence and bytecode of the 'GasX' contract on a public network,
// loading the deployed address dynamically using hardhat-deploy's deployments.get().

import { expect } from "chai";
import { deployments, network } from "hardhat"; // Import deployments
import { createPublicClient, http } from "viem";
import { scrollSepolia } from "viem/chains";

describe("Network Public Test - GasX Deployment", function () {
  let publicClient: ReturnType<typeof createPublicClient>;
  let gasXAddress: `0x${string}`;

  before(async function () {
    const networkName = network.name;
    if (networkName !== "scrollSepolia") {
      this.skip(); // Skip if not on Scroll Sepolia
    }

    console.log(`\n--- Test Setup Complete ---`);
    console.log(`  Running on public network: ${networkName}`);
    console.log(`---------------------------\n`);

    // Load GasX deployment dynamically using deployments.get()
    try {
      const gasXDeployment = await deployments.get("GasX"); // Use deployments.get()
      gasXAddress = gasXDeployment.address as `0x${string}`;
    } catch (error: any) {
      throw new Error(`Failed to load GasX deployment for scrollSepolia: ${error.message || error}`);
    }

    publicClient = createPublicClient({
      chain: scrollSepolia,
      transport: http((network.config as any).url),
    });
  });

  it("Should correctly load GasX deployment and verify its bytecode on Scroll Sepolia", async function () {
    expect(typeof gasXAddress === "string" && gasXAddress.length > 0).to.equal(true);
    console.log(`  > Successfully loaded 'GasX' deployment at address: ${gasXAddress}`);

    const bytecode = await publicClient.getCode({ address: gasXAddress });
    expect(bytecode).to.not.equal(undefined);
    expect(bytecode).to.not.equal("0x");
    console.log(`  > Bytecode found for 'GasX' on ${network.name}.`);
  });
});
