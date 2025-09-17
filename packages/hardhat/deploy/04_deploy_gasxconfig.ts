import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { verifyContract } from "../helpers/verify";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";
import { networkConfigs } from "../config/networks";

/**
 * @notice Deploys the GasXConfig contract using network-specific configurations.
 * @dev This script reads the `oracleSigner` address for the target chain from a
 * centralized configuration object and passes it to the contract's constructor.
 * It ensures that the project's configuration is deployed correctly for each environment.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const artifactName = "GasXConfig";
  const forceRedeploy = process.env.REDEPLOY_ALL === "true" || process.env.REDEPLOY_GASXCONFIG === "true";

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId?.toString() ?? (await hre.getChainId());
  log(`\n🛰️  Deploying: ${artifactName}`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Deployer:    ${deployer}`);
  log(`----------------------------------------------------`);

  // --- Configuration Validation ---
  log("  > Validating configuration for this network...");
  const cfg = networkConfigs[chainId];
  if (!cfg) {
    throw new Error(`❌ Configuration not found for chainId ${chainId}. Please update the CONFIGS object.`);
  }
  if (!ethers.isAddress(cfg.oracleSigner) || cfg.oracleSigner === ethers.ZeroAddress) {
    throw new Error(
      `❌ Invalid oracleSigner address for chainId ${chainId}: "${cfg.oracleSigner}". Please check your .env file.`,
    );
  }
  log(`    ✅ Oracle Signer: ${cfg.oracleSigner}`);

  // --- Deployment ---
  if (!forceRedeploy) {
    const existing = await deployments.getOrNull(artifactName);
    if (existing) {
      log(`⚠️  ${artifactName} already deployed at ${existing.address}`);
      log(`ℹ️  To force a redeploy, set REDEPLOY_GASXCONFIG=true or REDEPLOY_ALL=true`);
      return;
    }
  }

  log(`🚀 Deploying ${artifactName}...`);

  const deployResult = await deploy(artifactName, {
    from: deployer,
    args: [cfg.oracleSigner],
    log: true,
  });

  log(`✅ ${artifactName} deployed at: ${deployResult.address}`);

  // --- Verification ---
  await verifyContract(hre, artifactName, deployResult.address, deployResult.args || []);
  log(`----------------------------------------------------\n`);
};

export default func;
func.tags = ["GasXConfig"];
