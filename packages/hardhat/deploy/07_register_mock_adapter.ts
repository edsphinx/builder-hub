import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";

/**
 * @notice Registers the mock EulerOracleAdapter with the main MultiOracleAggregator instance.
 * @dev This script should only run on local development networks. It connects the mock
 * environment deployed in the previous step to the core oracle system for end-to-end testing.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { log, get } = deployments;
  const { deployer } = await getNamedAccounts(); // Get deployer for the log header

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  log(`\n🛰️  Configuring: Register Mock Oracle Adapter`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Signer:      ${deployer}`);
  log(`----------------------------------------------------`);

  // --- 1. Get Deployed Contract Instances ---
  log("  > Fetching deployed contracts for registration...");
  const aggregatorDeployment = await get("MultiOracleAggregatorInstance");
  const adapterDeployment = await get("EulerOracleAdapterInstance");
  const baseToken = (await get("MockERC20_WETH")).address;
  const quoteToken = (await get("MockERC20_USDC")).address;

  log(`    - Aggregator: ${aggregatorDeployment.address}`);
  log(`    - Adapter to register: ${adapterDeployment.address}`);
  log(`    - Token Pair: WETH/USDC`);

  // --- 2. Register the Adapter ---
  log("\n  > Registering adapter with the MultiOracleAggregator...");
  const aggregator = await ethers.getContractAt("MultiOracleAggregator", aggregatorDeployment.address);

  const tx = await aggregator.addOracle(baseToken, quoteToken, adapterDeployment.address);
  log(`    > Transaction sent: ${tx.hash}. Waiting for confirmation...`);
  await tx.wait();

  log(
    `✅ Adapter ${adapterDeployment.address} successfully registered for the WETH/USDC ${baseToken}/${quoteToken} pair.`,
  );
  log(`----------------------------------------------------\n`);
};
func.skip = async hre => {
  const { network } = hre;
  return network.name !== "localhost" && network.name !== "hardhat";
};
func.skip = async hre => {
  const { network } = hre;
  // Skip on any non-local network...
  if (network.name !== "localhost" && network.name !== "hardhat") {
    // ...unless the DEPLOY_MOCKS flag is explicitly set to true.
    if (process.env.DEPLOY_MOCKS !== "true") {
      console.log(`\n⏩ Skipping mock adapter registration on ${network.name}.`);
      console.log(`(Set DEPLOY_MOCKS=true to deploy anyway.)`);
      return true; // Skips the registration.
    }
  }
  return false; // Proceeds on local networks or if DEPLOY_MOCKS is true.
};
export default func;
func.tags = ["RegisterMockAdapter"];
func.dependencies = ["MockEulerEnv", "MultiOracleAggregatorInstance"];
