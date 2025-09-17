import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";

/**
 * @notice Deploys a mock environment for testing the EulerOracleAdapter.
 * @dev This script should only run on local development networks (hardhat, localhost).
 * It deploys mock ERC20 tokens (WETH, USDC) and a MockEulerOracle to simulate a live environment.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  log(`\n🛰️  Deploying: Mock Euler Environment`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Deployer:    ${deployer}`);
  log(`----------------------------------------------------`);

  // --- 1. Deploy Mock Tokens ---
  log("  > Deploying Mock ERC20 tokens (WETH & USDC)...");
  const weth = await deploy("MockERC20_WETH", {
    contract: "MockERC20",
    from: deployer,
    args: ["Wrapped Ether", "WETH", 18],
    log: true,
  });
  const usdc = await deploy("MockERC20_USDC", {
    contract: "MockERC20",
    from: deployer,
    args: ["USD Coin", "USDC", 6],
    log: true,
  });
  log(`    ✅ Mock WETH deployed at: ${weth.address}`);
  log(`    ✅ Mock USDC deployed at: ${usdc.address}`);

  // --- 2. Deploy Mock Oracle ---
  log("\n  > Deploying MockEulerOracle...");
  const mockPrice = ethers.parseUnits("3000", 18); // Simulate 1 WETH = 3000 USDC
  const oracle = await deploy("MockEulerOracle", {
    from: deployer,
    args: [mockPrice],
    log: true,
  });
  log(`    ✅ MockEulerOracle deployed at: ${oracle.address} with price ${ethers.formatEther(mockPrice)}`);

  // --- 3. Deploy Euler Oracle Adapter ---
  log("\n  > Deploying EulerOracleAdapter...");
  const adapter = await deploy("EulerOracleAdapterInstance", {
    contract: "EulerOracleAdapter",
    from: deployer,
    args: [oracle.address, weth.address, usdc.address],
    log: true,
  });
  log(`    ✅ EulerOracleAdapter deployed at: ${adapter.address}`);
  log(`----------------------------------------------------\n`);
};
func.skip = async hre => {
  const { network } = hre;
  // Skip on any non-local network...
  if (network.name !== "localhost" && network.name !== "hardhat") {
    // ...unless the DEPLOY_MOCKS flag is explicitly set to true.
    if (process.env.DEPLOY_MOCKS !== "true") {
      console.log(`\n⏩ Skipping mock environment deployment on ${network.name}.`);
      console.log(`(Set DEPLOY_MOCKS=true to deploy anyway.)`);
      return true; // Skips the deployment.
    }
  }
  return false; // Proceeds with deployment on local networks or if DEPLOY_MOCKS is true.
};
export default func;
func.tags = ["MockEulerEnv"];
