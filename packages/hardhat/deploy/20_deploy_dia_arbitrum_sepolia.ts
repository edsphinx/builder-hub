import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";
import { DIAAdapterFactory } from "../typechain-types";

/**
 * @notice Deploys and configures the DIA oracle adapters specifically for the Arbitrum Sepolia network.
 * @dev This script first deploys a new, chain-specific DIAAdapterFactory configured with the
 * Arbitrum Sepolia DIA oracle address. It then uses this factory to deploy and register
 * adapters for the WETH/USD and USDC/USD price feeds.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network, deployments, getNamedAccounts } = hre;
  const { log, get, deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);

  // --- Network Guard ---
  if (network.name !== "arbitrumSepolia") {
    log(`⏩ Skipping: This script is only for arbitrumSepolia, not ${network.name}.`);
    return;
  }

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  log(`\n🛰️  Deploying: DIA Oracle Adapter Setup for Arbitrum Sepolia`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Deployer:    ${deployer}`);
  log(`----------------------------------------------------`);

  // --- 1. Load Config from .env and Dependencies ---
  log("  > Step 1: Loading configuration and dependencies...");
  const DIA_ORACLE_ADDRESS = process.env.ARBITRUM_SEPOLIA_DIA_ORACLE_ADDRESS;
  if (!DIA_ORACLE_ADDRESS) throw new Error("Missing ARBITRUM_SEPOLIA_DIA_ORACLE_ADDRESS in .env file");

  const WETH_ADDRESS = process.env.ARBITRUM_SEPOLIA_WETH_ADDRESS;
  if (!WETH_ADDRESS) throw new Error("Missing ARBITRUM_SEPOLIA_WETH_ADDRESS in .env file");

  const USDC_ADDRESS = process.env.ARBITRUM_SEPOLIA_USDC_ADDRESS;
  if (!USDC_ADDRESS) throw new Error("Missing ARBITRUM_SEPOLIA_USDC_ADDRESS in .env file");

  const aggregatorInstance = await get("MultiOracleAggregatorInstance");
  log(`    ✅ Dependencies loaded. Using Aggregator at: ${aggregatorInstance.address}`);

  // --- 2. Deploy Chain-Specific DIAAdapterFactory ---
  const factoryDeploymentName = `DIAAdapterFactory_${network.name}`;
  log(`\n  > Step 2: Deploying new, chain-specific factory: ${factoryDeploymentName}...`);

  const factoryDeployment = await deploy(factoryDeploymentName, {
    contract: "DIAAdapterFactory",
    from: deployer,
    args: [aggregatorInstance.address, DIA_ORACLE_ADDRESS],
    log: true,
  });
  log(`    ✅ New factory deployed at: ${factoryDeployment.address}`);

  // --- 3. Deploy and Register Adapters ---
  log(`\n  > Step 3: Deploying and registering oracle adapters...`);
  const diaAdapterFactory = (await ethers.getContractAt(
    "DIAAdapterFactory",
    factoryDeployment.address,
    signer,
  )) as DIAAdapterFactory;

  const adaptersToDeploy = [
    { base: WETH_ADDRESS, quote: USDC_ADDRESS, key: "WETH/USD" },
    { base: USDC_ADDRESS, quote: WETH_ADDRESS, key: "USDC/USD" },
  ];

  for (const adapter of adaptersToDeploy) {
    log(`    - Processing adapter for ${adapter.key}...`);
    const tx = await diaAdapterFactory.deployAdapter(adapter.base, adapter.quote, adapter.key);
    log(`      > Tx sent: ${tx.hash}. Waiting for confirmation...`);
    await tx.wait();
    log(`      ✅ Adapter for ${adapter.key} registered successfully.`);
  }

  log(`----------------------------------------------------\n`);
};
export default func;
func.tags = ["DIA_Arbitrum_Setup"];
func.dependencies = ["MultiOracleAggregatorInstance"];
