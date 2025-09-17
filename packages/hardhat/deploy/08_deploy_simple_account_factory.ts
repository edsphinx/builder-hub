import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { entryPoint08Address } from "viem/account-abstraction";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";
import { verifyContract } from "../helpers/verify";

/**
 * @notice Deploys the SimpleAccountFactory contract from the @account-abstraction/contracts package.
 * @dev This script dynamically links the factory to the correct EntryPoint address:
 * - For local networks, it uses the locally deployed EntryPoint.
 * - For public networks, it uses the canonical EntryPoint v0.8 address.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const artifactName = "SimpleAccountFactory";
  const forceRedeploy = process.env.REDEPLOY_ALL === "true" || process.env.REDEPLOY_SIMPLE_ACCOUNT_FACTORY === "true";

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
      log(`ℹ️  To force a redeploy, set the relevant REDEPLOY flag to true.`);
      return;
    }
  }

  // --- Get EntryPoint Address (Conditionally) ---
  let entryPointAddress: string;
  const isLocalNetwork = network.name === "hardhat" || network.name === "localhost";

  if (isLocalNetwork) {
    log("  > Network is local, fetching deployed EntryPoint...");
    const entryPoint = await hre.deployments.get("EntryPoint");
    entryPointAddress = entryPoint.address;
  } else {
    log("  > Network is public, using official EntryPoint address from viem...");
    entryPointAddress = entryPoint08Address;
  }
  log(`    ✅ Using EntryPoint at: ${entryPointAddress}`);

  // --- Deploy ---
  const SIMPLE_ACCOUNT_FACTORY_FQN =
    "@account-abstraction/contracts/accounts/SimpleAccountFactory.sol:SimpleAccountFactory";

  log(`🚀 Deploying ${artifactName}...`);

  const deployResult = await deploy(artifactName, {
    from: deployer,
    args: [entryPointAddress],
    contract: SIMPLE_ACCOUNT_FACTORY_FQN,
    log: true,
  });

  log(`✅ ${artifactName} deployed at: ${deployResult.address}`);

  // --- Verification ---
  await verifyContract(hre, artifactName, deployResult.address, deployResult.args || []);
  log(`----------------------------------------------------\n`);
};
export default func;
func.tags = ["SimpleAccountFactory"];
func.dependencies = ["EntryPoint"];
