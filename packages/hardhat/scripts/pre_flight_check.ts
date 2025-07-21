import "dotenv/config";
import fs from "fs";
import path from "path";
import { createPublicClient, createWalletClient, http, Address, toFunctionSelector } from "viem";
import { privateKeyToAccount } from "viem/accounts"; // Corrected import
import { scrollSepolia } from "viem/chains";
import { Wallet } from "ethers";

async function runCheck(checkName: string, checkFunction: () => Promise<void> | void) {
  process.stdout.write(`- ${checkName}... `);
  try {
    await checkFunction();
    console.log("✅ PASS");
    return true;
  } catch (error: any) {
    console.log("❌ FAIL");
    console.error("  Error details:", error.message || error);
    return false;
  }
}

async function main() {
  console.log("\n--- Pre-Flight Check for Sponsorship Test ---");
  let allChecksPassed = true;

  // --- 1. Check Environment Variables ---
  allChecksPassed =
    (await runCheck(
      "Environment variables (PIMLICO_API_KEY, DEPLOYER_PRIVATE_KEY_ENCRYPTED, DEPLOYER_PASSWORD)",
      () => {
        const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
        const DEPLOYER_PRIVATE_KEY_ENCRYPTED = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
        const DEPLOYER_PASSWORD = process.env.DEPLOYER_PASSWORD;
        if (!PIMLICO_API_KEY || !DEPLOYER_PRIVATE_KEY_ENCRYPTED || !DEPLOYER_PASSWORD) {
          throw new Error("One or more required environment variables are missing.");
        }
      },
    )) && allChecksPassed;

  // --- 2. Decrypt Deployer Wallet ---
  let deployerPrivateKey: string | undefined;
  allChecksPassed =
    (await runCheck("Decrypt deployer wallet", async () => {
      const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED!;
      const password = process.env.DEPLOYER_PASSWORD!;
      const decryptedWallet = await Wallet.fromEncryptedJson(encryptedKey, password);
      deployerPrivateKey = decryptedWallet.privateKey;
      if (!deployerPrivateKey) {
        throw new Error("Decrypted private key is empty.");
      }
    })) && allChecksPassed;

  // --- 3. Load Deployment Artifacts and Validate Addresses/ABIs ---
  const deploymentsDir = path.resolve(__dirname, "../deployments/scrollSepolia");
  const contractArtifacts = {
    GasX: null as any,
    MockTarget: null as any,
    SimpleAccountFactory: null as any,
  };

  for (const contractName of Object.keys(contractArtifacts)) {
    allChecksPassed =
      (await runCheck(`Load ${contractName} deployment artifact`, () => {
        const artifactPath = path.join(deploymentsDir, `${contractName}.json`);
        if (!fs.existsSync(artifactPath)) {
          throw new Error(`File not found: ${artifactPath}`);
        }
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        if (!artifact.address || !artifact.abi) {
          throw new Error(`Missing address or ABI in ${contractName}.json`);
        }
        contractArtifacts[contractName as keyof typeof contractArtifacts] = artifact;
      })) && allChecksPassed;
  }

  // --- 4. Initialize Viem Clients ---
  let publicClient: any;
  let walletClient: any;
  let deployerAccount: any;

  allChecksPassed =
    (await runCheck("Initialize Viem Public Client", () => {
      publicClient = createPublicClient({
        transport: http(scrollSepolia.rpcUrls.default.http[0]),
        chain: scrollSepolia,
      });
      if (!publicClient) throw new Error("Public client not initialized.");
    })) && allChecksPassed;

  allChecksPassed =
    (await runCheck("Initialize Viem Wallet Client and Deployer Account", () => {
      if (!deployerPrivateKey) throw new Error("Deployer private key is missing.");
      deployerAccount = privateKeyToAccount(deployerPrivateKey as Address);
      walletClient = createWalletClient({
        account: deployerAccount,
        chain: scrollSepolia,
        transport: http(),
      });
      if (!walletClient || !deployerAccount) throw new Error("Wallet client or deployer account not initialized.");
    })) && allChecksPassed;

  // --- 5. Get Function Selector (MockTarget) ---
  allChecksPassed =
    (await runCheck("Get MockTarget execute function selector", () => {
      if (!contractArtifacts.MockTarget) throw new Error("MockTarget artifact not loaded.");
      const selector = toFunctionSelector("execute()");
      if (!selector) throw new Error("Selector is undefined.");
    })) && allChecksPassed;

  console.log("\n--- Pre-Flight Check Complete ---");
  if (allChecksPassed) {
    console.log("All pre-flight checks passed. The sponsorship test should now run.");
    process.exit(0);
  } else {
    console.log("Some pre-flight checks failed. Please review the errors above.");
    process.exit(1);
  }
}

main();
