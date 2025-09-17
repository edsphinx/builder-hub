import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { resolveEnvironment, getEnvironmentName } from "../helpers/environment";
import { verifyContract } from "../helpers/verify";

/**
 * @notice Deploys the logic implementation of the MultiOracleAggregator contract.
 * @dev This script deploys the base contract without an initializer, intended to be used
 * behind a UUPS proxy. The deployment can be forced by setting the
 * REDEPLOY_MULTI_ORACLE=true environment variable.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const artifactName = "MultiOracleAggregator";
  const forceRedeploy = process.env.REDEPLOY_ALL === "true" || process.env.REDEPLOY_MULTI_ORACLE === "true";

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  log(`\n🛰️  Deploying: ${artifactName}`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Deployer:    ${deployer}`);
  log(`----------------------------------------------------`);

  // Skip deployment if it already exists and redeploy is not forced
  if (!forceRedeploy) {
    const existing = await deployments.getOrNull(artifactName);
    if (existing) {
      log(`⚠️  ${artifactName} already deployed at ${existing.address}`);
      log(`ℹ️  To force a redeploy, set REDEPLOY_MULTI_ORACLE=true`);
      return;
    }
  }

  log(`🚀 Deploying ${artifactName} logic...`);

  const deployResult = await deploy(artifactName, {
    from: deployer,
    args: [], // No constructor arguments, as it's initialized by the proxy
    log: true,
  });

  log(`✅ ${artifactName} (logic implementation) deployed at: ${deployResult.address}`);

  // Verify the contract on Etherscan-like explorers
  await verifyContract(hre, artifactName, deployResult.address, deployResult.args || []);
  log(`----------------------------------------------------\n`);
};

export default func;
func.tags = ["MultiOracleAggregator"];
