// This test is designed to verify the functionality of the `permissionless` library
// for smart account creation on public networks, leveraging the `createPublicSmartAccount` helper.

import { expect } from "chai";
import { network } from "hardhat";
import { createPublicClient, http, isAddress } from "viem";
import { scrollSepolia } from "viem/chains";
import { createPublicSmartAccount } from "../helpers/publicSmartAccount";

describe("Permissionless Smart Account Creation on Public Networks", () => {
  let publicClient: ReturnType<typeof createPublicClient>;

  before(async function () {
    // Validate environment variables required by the helper
    const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
    const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
    const password = process.env.DEPLOYER_PASSWORD;

    if (!PIMLICO_API_KEY || !encryptedKey || !password) {
      throw new Error(
        "❌ Fatal Error: Required environment variables (.env) not found. Please ensure PIMLICO_API_KEY, DEPLOYER_PRIVATE_KEY_ENCRYPTED, and DEPLOYER_PASSWORD are set.",
      );
    }

    if (!("url" in network.config)) {
      throw new Error("Hardhat network configuration does not have a `url` property.");
    }

    // Create a PublicClient for Scroll Sepolia
    publicClient = createPublicClient({
      chain: scrollSepolia,
      transport: http((network.config as any).url),
    });

    console.log(`\n--- Test Setup Complete ---`);
    console.log(`  Network: ${network.name}`);
    console.log(`---------------------------\n`);
  });

  it("should successfully create a smart account using permissionless on a public network", async function () {
    this.timeout(60000); // Set timeout for this specific test

    try {
      console.log("[TEST] Attempting to create smart account using permissionless helper...");
      const smartAccount = await createPublicSmartAccount(
        publicClient,
        process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED!,
        process.env.DEPLOYER_PASSWORD!,
      );

      console.log(`[TEST] Success! Smart Account Address: ${smartAccount.address}`);
      expect(isAddress(smartAccount.address)).to.equal(true); // Corrected assertion
    } catch (error: any) {
      console.error("[TEST] FAILED to create smart account:", error);
      expect.fail(`Test failed: ${error.message || error}`);
    }
  });
});
