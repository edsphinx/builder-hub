// This test is specifically designed to verify the functionality of the `createPublicSmartAccount` helper.
// It ensures that the helper correctly creates a smart account for public networks using the permissionless library.

import { expect } from "chai";
import { network } from "hardhat";
import { createPublicClient, http, isAddress } from "viem";
import { scrollSepolia } from "viem/chains";
import { createPublicSmartAccount } from "../helpers/publicSmartAccount";

describe("Public Smart Account Helper Functionality", () => {
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
      // Do not pass 'account' here; PublicClient expects account: undefined
    });

    console.log(`\n--- Helper Test Setup Complete ---`);
    console.log(`  Network: ${network.name}`);
    console.log(`----------------------------------\n`);
  });

  it("should successfully create a public smart account using the helper", async function () {
    this.timeout(60000); // Set timeout for this specific test

    try {
      console.log("[TEST] Attempting to create public smart account using helper...");
      const smartAccount = await createPublicSmartAccount(
        publicClient,
        process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED!,
        process.env.DEPLOYER_PASSWORD!,
      );

      console.log(`[TEST] Success! Smart Account Address: ${smartAccount.address}`);
      expect(isAddress(smartAccount.address)).to.equal(true);
    } catch (error: any) {
      console.error("[TEST] FAILED to create public smart account using helper:", error);
      expect.fail(`Helper test failed: ${error.message || error}`);
    }
  });
});
