import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";

/**
 * @notice Deploys the MockOracle contract for local testing and E2E tests.
 * @dev By default, this script is skipped on public networks. To deploy mocks to a
 * live testnet for E2E testing, set the `DEPLOY_MOCKS=true` environment variable.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const artifactName = "MockOracle";

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  log(`\n🛰️  Deploying: ${artifactName}`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Deployer:    ${deployer}`);
  log(`----------------------------------------------------`);

  // The MockOracle constructor needs an initial price.
  // We'll set a default of $3000 with 18 decimals.
  const initialPrice = ethers.parseEther("3000");

  log(`🚀 Deploying ${artifactName} with initial price of ${ethers.formatEther(initialPrice)}...`);

  await deploy(artifactName, {
    from: deployer,
    args: [initialPrice],
    log: true,
  });

  log(`✅ ${artifactName} deployed.`);
  log(`----------------------------------------------------\n`);
};
func.skip = async hre => {
  const { network } = hre;
  // Skip on any non-local network...
  if (network.name !== "localhost" && network.name !== "hardhat") {
    // ...unless the DEPLOY_MOCKS flag is explicitly set to true.
    if (process.env.DEPLOY_MOCKS !== "true") {
      console.log(`\n⏩ Skipping mock contract deployment on ${network.name}.`);
      console.log(`(Set DEPLOY_MOCKS=true to deploy anyway.)`);
      return true; // Skips the deployment.
    }
  }
  return false; // Proceeds with deployment on local networks or if DEPLOY_MOCKS is true.
};
export default func;
func.tags = ["MockOracle"];
