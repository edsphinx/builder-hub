import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { verifyContract } from "../helpers/verify";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";

/**
 * @notice Deploys an initial, upgradeable UUPS proxy instance of the MultiOracleAggregator.
 * @dev This script creates the primary, reference instance of the oracle aggregator,
 * using the logic contract deployed in the previous step.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { get, save } = deployments;
  const { deployer } = await getNamedAccounts();
  const log = deployments.log;

  const logicContractName = "MultiOracleAggregator";
  const proxyDeploymentName = "MultiOracleAggregatorInstance";
  const forceRedeploy = process.env.REDEPLOY_ALL === "true" || process.env.REDEPLOY_MULTI_AGGREGATOR === "true";

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  log(`\n🛰️  Deploying: ${proxyDeploymentName} (UUPS Proxy)`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Deployer:    ${deployer}`);
  log(`----------------------------------------------------`);

  // Check for dependency
  await get(logicContractName);

  // Skip deployment if it already exists and redeploy is not forced
  if (!forceRedeploy) {
    const existing = await deployments.getOrNull(proxyDeploymentName);
    if (existing) {
      log(`⚠️  ${proxyDeploymentName} already deployed at ${existing.address}`);
      log(`ℹ️  To force a redeploy, set REDEPLOY_MULTI_AGGREGATOR=true or REDEPLOY_ALL=true`);
      return;
    }
  }

  // Initializer arguments
  const maxDeviationBps = 300; // 3% maximum deviation

  log(`🚀 Deploying UUPS proxy for ${logicContractName}...`);
  const factory = await ethers.getContractFactory(logicContractName);

  const instance = await upgrades.deployProxy(factory, [deployer, maxDeviationBps], {
    kind: "uups",
    initializer: "initialize",
  });

  await instance.waitForDeployment();
  const instanceAddress = await instance.getAddress();

  // Manually save the deployment info for hardhat-deploy
  const artifact = await deployments.getArtifact(logicContractName);
  await save(proxyDeploymentName, {
    address: instanceAddress,
    abi: artifact.abi,
  });

  log(`✅ ${proxyDeploymentName} deployed at: ${instanceAddress}`);

  // Verification is tricky for proxies. We verify the implementation, which is already done.
  // Here, we would try to verify the proxy on Etherscan, though it often requires manual steps
  // to verify the implementation logic, TODO: see if this can be automated.
  log(`ℹ️  To verify on Etherscan, verify the implementation logic at the proxy address.`);
  await verifyContract(hre, proxyDeploymentName, instanceAddress, [deployer, maxDeviationBps]);
  log(`----------------------------------------------------\n`);
};

export default func;
func.tags = ["MultiOracleAggregatorInstance"];
func.dependencies = ["MultiOracleAggregator"];
