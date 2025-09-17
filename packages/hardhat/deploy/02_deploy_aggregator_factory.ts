import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { resolveEnvironment, getEnvironmentName } from "../helpers/environment";
import { verifyContract } from "../helpers/verify";

/**
 * @notice Deploys the AggregatorFactory, linking it to the MultiOracleAggregator logic contract.
 * @dev This factory will use the deployed MultiOracleAggregator implementation as the blueprint
 * for creating new proxy instances.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, getOrNull, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const factoryName = "AggregatorFactory";
  const implementationName = "MultiOracleAggregator"; // The logic contract blueprint
  const forceRedeploy = process.env.REDEPLOY_ALL === "true" || process.env.REDEPLOY_AGGREGATOR_FACTORY === "true";

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  log(`\n🛰️  Deploying: ${factoryName}`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Deployer:    ${deployer}`);
  log(`----------------------------------------------------`);

  // Robust Check for Implementation Contract
  log(`  > Checking for dependency: ${implementationName}...`);
  const implementation = await getOrNull(implementationName);
  if (!implementation || !ethers.isAddress(implementation.address) || implementation.address === ethers.ZeroAddress) {
    throw new Error(
      `❌ Could not find a valid deployment for ${implementationName}. Run the 'MultiOracleAggregator' deployment script first.`,
    );
  }
  log(`    ✅ Found at: ${implementation.address}`);

  // Skip deployment if it already exists and redeploy is not forced
  if (!forceRedeploy) {
    const existing = await getOrNull(factoryName);
    if (existing) {
      log(`⚠️  ${factoryName} already deployed at ${existing.address}`);
      log(`ℹ️  To force a redeploy, set REDEPLOY_AGGREGATOR_FACTORY=true`);
      return;
    }
  }

  log(`🚀 Deploying ${factoryName}, linked to ${implementationName}...`);

  const deployResult = await deploy(factoryName, {
    from: deployer,
    args: [implementation.address], // Pass the logic contract's address to the factory constructor
    log: true,
  });

  log(`✅ ${factoryName} deployed at: ${deployResult.address}`);

  // Verify the contract on Etherscan-like explorers
  await verifyContract(hre, factoryName, deployResult.address, deployResult.args || []);
  log(`----------------------------------------------------\n`);
};

export default func;
func.tags = ["AggregatorFactory"];
func.dependencies = ["MultiOracleAggregator"];
