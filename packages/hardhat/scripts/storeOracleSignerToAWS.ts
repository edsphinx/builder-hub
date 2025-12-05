import "dotenv/config";
import { ethers } from "ethers";
import { execSync } from "child_process";

/**
 * @title Store Oracle Signer to AWS Secrets Manager
 * @notice Generates a new Oracle Signer wallet and stores the PK in AWS Secrets Manager
 * @dev Requires AWS CLI configured with SecretsManagerReadWrite permissions
 *
 * Usage:
 *   NETWORK=arbitrumSepolia ts-node scripts/storeOracleSignerToAWS.ts
 *   NETWORK=scrollSepolia ts-node scripts/storeOracleSignerToAWS.ts
 *   NETWORK=baseSepolia ts-node scripts/storeOracleSignerToAWS.ts
 *
 * To use existing PK:
 *   NETWORK=arbitrumSepolia SIGNER_PK=0x... ts-node scripts/storeOracleSignerToAWS.ts
 */

const NETWORK_CONFIG: Record<string, { chainId: number; secretName: string }> = {
  arbitrumSepolia: {
    chainId: 421614,
    secretName: "gasx/oracle-signer/arbitrum-sepolia",
  },
  scrollSepolia: {
    chainId: 534351,
    secretName: "gasx/oracle-signer/scroll-sepolia",
  },
  baseSepolia: {
    chainId: 84532,
    secretName: "gasx/oracle-signer/base-sepolia",
  },
  arbitrum: {
    chainId: 42161,
    secretName: "gasx/oracle-signer/arbitrum",
  },
  scroll: {
    chainId: 534352,
    secretName: "gasx/oracle-signer/scroll",
  },
  base: {
    chainId: 8453,
    secretName: "gasx/oracle-signer/base",
  },
  optimism: {
    chainId: 10,
    secretName: "gasx/oracle-signer/optimism",
  },
  optimismSepolia: {
    chainId: 11155420,
    secretName: "gasx/oracle-signer/optimism-sepolia",
  },
};

async function main() {
  const network = process.env.NETWORK;
  const existingPK = process.env.SIGNER_PK;
  const awsRegion = process.env.AWS_REGION || "us-east-1";

  if (!network) {
    console.error("❌ NETWORK environment variable required");
    console.log("   Usage: NETWORK=arbitrumSepolia ts-node scripts/storeOracleSignerToAWS.ts");
    console.log(`   Available networks: ${Object.keys(NETWORK_CONFIG).join(", ")}`);
    process.exit(1);
  }

  const config = NETWORK_CONFIG[network];
  if (!config) {
    console.error(`❌ Unknown network: ${network}`);
    console.log(`   Available networks: ${Object.keys(NETWORK_CONFIG).join(", ")}`);
    process.exit(1);
  }

  console.log("\n🔐 AWS SECRETS MANAGER - ORACLE SIGNER");
  console.log("======================================");
  console.log(`📍 Network: ${network}`);
  console.log(`🔗 Chain ID: ${config.chainId}`);
  console.log(`📦 Secret Name: ${config.secretName}`);
  console.log("");

  // Generate or use existing wallet
  let wallet: ethers.Wallet | ethers.HDNodeWallet;
  if (existingPK) {
    try {
      wallet = new ethers.Wallet(existingPK);
      console.log("✅ Using provided private key");
    } catch {
      console.error("❌ Invalid private key format");
      process.exit(1);
    }
  } else {
    wallet = ethers.Wallet.createRandom();
    console.log("🆕 Generated new wallet");
  }

  console.log(`📍 Address: ${wallet.address}`);
  console.log("");

  // Prepare secret value
  const secretValue = JSON.stringify({
    address: wallet.address,
    privateKey: wallet.privateKey,
    network: network,
    chainId: config.chainId,
    createdAt: new Date().toISOString(),
  });

  // Update or create secret in AWS
  try {
    // First try to update existing secret
    const updateCmd = `aws secretsmanager put-secret-value --secret-id "${config.secretName}" --secret-string '${secretValue}' --region ${awsRegion}`;

    console.log("📤 Updating secret in AWS Secrets Manager...");
    execSync(updateCmd, { stdio: "pipe" });
    console.log("✅ Secret updated successfully!");
  } catch (updateError: any) {
    // If update fails, try to create new secret
    if (updateError.message?.includes("ResourceNotFoundException")) {
      try {
        const createCmd = `aws secretsmanager create-secret --name "${config.secretName}" --description "Oracle Signer PK for GasX on ${network}" --secret-string '${secretValue}' --region ${awsRegion}`;
        console.log("📤 Creating new secret in AWS Secrets Manager...");
        execSync(createCmd, { stdio: "pipe" });
        console.log("✅ Secret created successfully!");
      } catch (createError: any) {
        console.error("❌ Failed to create secret:", createError.message);
        process.exit(1);
      }
    } else {
      console.error("❌ Failed to update secret:", updateError.message);
      process.exit(1);
    }
  }

  console.log("");
  console.log("=".repeat(50));
  console.log("📝 NEXT STEPS:");
  console.log("=".repeat(50));
  console.log(`\n1. Add the Oracle Signer address to your .env:`);
  console.log(`   ${network.toUpperCase().replace(/-/g, "_")}_ORACLE_SIGNER="${wallet.address}"`);
  console.log(`\n2. Fund this address with ETH for gas:`);
  console.log(`   Address: ${wallet.address}`);
  console.log(`\n3. To retrieve the PK in your backend:`);
  console.log(`   aws secretsmanager get-secret-value --secret-id "${config.secretName}" --region ${awsRegion}`);
  console.log("");
}

main().catch(console.error);
