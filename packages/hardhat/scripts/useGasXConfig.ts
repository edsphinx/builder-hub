import { ethers, deployments, network } from "hardhat";
import { GasXConfig } from "../typechain-types";

/**
 * @notice A read-only script to fetch and display the current oracleSigner
 * address from the deployed GasXConfig contract on a given network.
 */
async function main() {
  const { log, get } = deployments;
  const networkName = network.name;

  log(`\n🔍 Reading GasXConfig on network: ${networkName}`);
  log(`----------------------------------------------------`);

  // Dynamically get the deployment for the current network
  const configDeployment = await get("GasXConfig");
  const config = (await ethers.getContractAt("GasXConfig", configDeployment.address)) as GasXConfig;

  const signer = await config.oracleSigner();

  log(`  > GasXConfig Address: ${configDeployment.address}`);
  log(`  ✅ Current Oracle Signer: ${signer}`);
  log(`----------------------------------------------------\n`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
