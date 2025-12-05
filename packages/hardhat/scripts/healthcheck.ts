import "dotenv/config";
import { ethers } from "ethers";

/**
 * @title GasX Health Check Script
 * @notice Verifies the health of deployed GasX infrastructure
 * @dev Run with: NETWORK=arbitrumSepolia ts-node scripts/healthcheck.ts
 */

interface NetworkConfig {
  rpcUrl: string;
  chainId: number;
  name: string;
  diaOracle?: string;
  diaGasWallet?: string;
  contracts?: {
    gasXConfig?: string;
    gasXWhitelistPaymaster?: string;
    multiOracleAggregator?: string;
    simpleAccountFactory?: string;
  };
}

const NETWORKS: Record<string, NetworkConfig> = {
  arbitrumSepolia: {
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    chainId: 421614,
    name: "Arbitrum Sepolia",
    diaOracle: "0x05eD1f0c33E2a2D257007C0184dC00020C0cbE68",
    diaGasWallet: "0xeFfFD5F03f027F411FA92A0E942e04741d50b3e4",
  },
  scrollSepolia: {
    rpcUrl: process.env.SCROLL_SEPOLIA_RPC_URL || "https://sepolia-rpc.scroll.io",
    chainId: 534351,
    name: "Scroll Sepolia",
  },
  baseSepolia: {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    chainId: 84532,
    name: "Base Sepolia",
  },
};

const DIA_ABI = ["function getValue(string key) view returns (uint128, uint128)"];

async function checkDIAOracle(provider: ethers.JsonRpcProvider, oracleAddress: string) {
  console.log("\n📊 DIA Oracle Status");
  console.log("=".repeat(40));

  const oracle = new ethers.Contract(oracleAddress, DIA_ABI, provider);

  try {
    const [wethPrice, wethTimestamp] = await oracle.getValue("WETH/USD");
    const wethPriceFormatted = Number(wethPrice) / 1e8;
    const wethAge = Math.round((Date.now() / 1000 - Number(wethTimestamp)) / 60);

    console.log(`WETH/USD: $${wethPriceFormatted.toFixed(2)}`);
    console.log(`  Updated: ${wethAge} minutes ago`);
    console.log(`  Status: ${wethAge < 1440 ? "✅ Fresh" : "⚠️ Stale (>24h)"}`);
  } catch (e: any) {
    console.log(`WETH/USD: ❌ Error - ${e.message}`);
  }

  try {
    const [usdcPrice, usdcTimestamp] = await oracle.getValue("USDC/USD");
    const usdcPriceFormatted = Number(usdcPrice) / 1e8;
    const usdcAge = Math.round((Date.now() / 1000 - Number(usdcTimestamp)) / 60);

    console.log(`USDC/USD: $${usdcPriceFormatted.toFixed(6)}`);
    console.log(`  Updated: ${usdcAge} minutes ago`);
    console.log(`  Status: ${usdcAge < 1440 ? "✅ Fresh" : "⚠️ Stale (>24h)"}`);
  } catch (e: any) {
    console.log(`USDC/USD: ❌ Error - ${e.message}`);
  }
}

async function checkGasWallet(provider: ethers.JsonRpcProvider, walletAddress: string, label: string) {
  const balance = await provider.getBalance(walletAddress);
  const balanceEth = Number(balance) / 1e18;
  const status = balanceEth >= 0.05 ? "✅ Healthy" : balanceEth >= 0.01 ? "⚠️ Low" : "❌ Critical";

  console.log(`${label}: ${balanceEth.toFixed(4)} ETH [${status}]`);
  return balanceEth;
}

async function checkContract(provider: ethers.JsonRpcProvider, address: string, name: string) {
  try {
    const code = await provider.getCode(address);
    if (code && code !== "0x") {
      console.log(`${name}: ✅ Deployed at ${address.slice(0, 10)}...`);
      return true;
    } else {
      console.log(`${name}: ❌ No code at ${address.slice(0, 10)}...`);
      return false;
    }
  } catch (e: any) {
    console.log(`${name}: ❌ Error - ${e.message}`);
    return false;
  }
}

async function main() {
  const networkName = process.env.NETWORK || "arbitrumSepolia";
  const config = NETWORKS[networkName];

  if (!config) {
    console.error(`❌ Unknown network: ${networkName}`);
    console.log(`Available: ${Object.keys(NETWORKS).join(", ")}`);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`🔍 GasX Health Check - ${config.name}`);
  console.log("=".repeat(50));

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  // Check network connectivity
  try {
    const network = await provider.getNetwork();
    console.log(`\n🌐 Network: Connected (Chain ID: ${network.chainId})`);
  } catch {
    console.log(`\n🌐 Network: ❌ Cannot connect to RPC`);
    process.exit(1);
  }

  // Check gas price
  const feeData = await provider.getFeeData();
  const gasPriceGwei = Number(feeData.gasPrice || 0) / 1e9;
  console.log(`⛽ Gas Price: ${gasPriceGwei.toFixed(4)} gwei`);

  // Check DIA Oracle if available
  if (config.diaOracle) {
    await checkDIAOracle(provider, config.diaOracle);
  }

  // Check wallets
  console.log("\n💰 Wallet Balances");
  console.log("=".repeat(40));

  if (config.diaGasWallet) {
    await checkGasWallet(provider, config.diaGasWallet, "DIA Gas Wallet");
  }

  // Check Oracle Signer
  const oracleSignerEnv = `${networkName.toUpperCase().replace(/-/g, "_")}_ORACLE_SIGNER`;
  const oracleSigner = process.env[oracleSignerEnv];
  if (oracleSigner) {
    await checkGasWallet(provider, oracleSigner, "Oracle Signer");
  }

  // Check Treasury (Safe)
  const treasuryEnv = `${networkName.toUpperCase().replace(/-/g, "_")}_PAYMASTER_TREASURY`;
  const treasury = process.env[treasuryEnv];
  if (treasury) {
    await checkGasWallet(provider, treasury, "Treasury (Safe)");
  }

  // Load deployed contracts from deployments folder
  console.log("\n📦 Deployed Contracts");
  console.log("=".repeat(40));

  try {
    const fs = await import("fs");
    const path = await import("path");
    const deploymentsPath = path.join(__dirname, "..", "deployments", networkName);

    if (fs.existsSync(deploymentsPath)) {
      const files = fs.readdirSync(deploymentsPath).filter((f: string) => f.endsWith(".json"));

      for (const file of files) {
        const deployment = JSON.parse(fs.readFileSync(path.join(deploymentsPath, file), "utf8"));
        if (deployment.address) {
          await checkContract(provider, deployment.address, file.replace(".json", ""));
        }
      }
    } else {
      console.log("No deployments folder found for this network");
    }
  } catch (e: any) {
    console.log(`Error reading deployments: ${e.message}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Health check complete");
  console.log("=".repeat(50) + "\n");
}

main().catch(console.error);
