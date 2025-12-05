import "dotenv/config";
import Safe, { SafeAccountConfig } from "@safe-global/protocol-kit";
import { ethers } from "ethers";

/**
 * @title Create Safe Wallet Script
 * @notice Creates a Safe multisig wallet on the specified network
 * @dev Uses @safe-global/protocol-kit to deploy a new Safe
 *
 * Usage:
 *   NETWORK=arbitrumSepolia yarn ts-node scripts/createSafeWallet.ts
 *   NETWORK=arbitrum yarn ts-node scripts/createSafeWallet.ts
 */

// Network configurations
const NETWORK_CONFIG: Record<string, { rpcUrl: string; chainId: number; name: string; explorer: string }> = {
  arbitrumSepolia: {
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    chainId: 421614,
    name: "Arbitrum Sepolia",
    explorer: "https://sepolia.arbiscan.io",
  },
  arbitrum: {
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
    name: "Arbitrum One",
    explorer: "https://arbiscan.io",
  },
  scrollSepolia: {
    rpcUrl: "https://sepolia-rpc.scroll.io",
    chainId: 534351,
    name: "Scroll Sepolia",
    explorer: "https://sepolia.scrollscan.com",
  },
  baseSepolia: {
    rpcUrl: "https://sepolia.base.org",
    chainId: 84532,
    name: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
  },
};

// Safe owners - these addresses will control the multisig (checksummed)
const SAFE_OWNERS = [
  "0xd7137FC5acE1327B816DE9271f12883EB885435e",
  "0xA2Fe9bf1fBEAc7b79B1C1562851EA6c03D5D3F04",
  "0xD5Ab8382BB8d33566Ab9549af5595Be4E06e57E2",
  "0xF39ca026377a84DE1ee49cB62bAC4e3aba8c73f7",
];

// Threshold - number of signatures required to execute transactions
const THRESHOLD = 2; // 2-of-4 multisig

async function main() {
  const networkName = process.env.NETWORK || "arbitrumSepolia";
  const network = NETWORK_CONFIG[networkName];

  if (!network) {
    console.error(`❌ Unknown network: ${networkName}`);
    console.log(`Available networks: ${Object.keys(NETWORK_CONFIG).join(", ")}`);
    process.exit(1);
  }

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ DEPLOYER_PRIVATE_KEY not found in .env");
    process.exit(1);
  }

  console.log("\n🔐 Creating Safe Multisig Wallet");
  console.log("================================");
  console.log(`📍 Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👥 Owners (${SAFE_OWNERS.length}):`);
  SAFE_OWNERS.forEach((owner, i) => console.log(`   ${i + 1}. ${owner}`));
  console.log(`🔑 Threshold: ${THRESHOLD}-of-${SAFE_OWNERS.length}`);
  console.log("================================\n");

  // Verify deployer has funds
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`💰 Deployer: ${wallet.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.01")) {
    console.error("❌ Insufficient balance for Safe deployment");
    process.exit(1);
  }

  // Configure Safe
  const safeAccountConfig: SafeAccountConfig = {
    owners: SAFE_OWNERS,
    threshold: THRESHOLD,
  };

  console.log("\n🚀 Deploying Safe...\n");

  try {
    // Initialize Protocol Kit and deploy Safe
    const protocolKit = await Safe.init({
      provider: network.rpcUrl,
      signer: privateKey,
      predictedSafe: {
        safeAccountConfig,
      },
    });

    // Get predicted address before deployment
    const predictedAddress = await protocolKit.getAddress();
    console.log(`📋 Predicted Safe Address: ${predictedAddress}`);

    // Deploy the Safe
    const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction();

    // Send the transaction
    const txResponse = await wallet.sendTransaction({
      to: deploymentTransaction.to,
      data: deploymentTransaction.data,
      value: BigInt(deploymentTransaction.value),
    });

    console.log(`📤 Transaction sent: ${txResponse.hash}`);
    console.log("⏳ Waiting for confirmation...\n");

    const receipt = await txResponse.wait();

    if (receipt?.status === 1) {
      console.log("✅ Safe deployed successfully!");
      console.log(`\n${"=".repeat(50)}`);
      console.log(`🏦 SAFE ADDRESS: ${predictedAddress}`);
      console.log(`${"=".repeat(50)}`);
      console.log(`\n📝 Add this to your .env file:`);
      console.log(`${networkName.toUpperCase().replace("-", "_")}_PAYMASTER_TREASURY="${predictedAddress}"`);
      console.log(`\n🔗 View on explorer:`);

      console.log(`${network.explorer}/address/${predictedAddress}`);
    } else {
      console.error("❌ Transaction failed");
    }
  } catch (error: any) {
    console.error("❌ Error deploying Safe:", error.message);

    // If Safe already exists at predicted address
    if (error.message?.includes("already deployed")) {
      console.log("\n💡 Safe may already exist at the predicted address");
    }
    process.exit(1);
  }
}

main().catch(console.error);
