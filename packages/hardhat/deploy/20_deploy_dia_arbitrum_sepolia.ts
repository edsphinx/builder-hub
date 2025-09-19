import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";
import { verifyContract } from "../helpers/verify";
import { DIAAdapterFactory, MultiOracleAggregator } from "../typechain-types";

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

  const factoryArgs = [aggregatorInstance.address, DIA_ORACLE_ADDRESS];
  const factoryDeployment = await deploy(factoryDeploymentName, {
    contract: "DIAAdapterFactory",
    from: deployer,
    args: factoryArgs,
    log: true,
  });
  log(`    ✅ New factory deployed at: ${factoryDeployment.address}`);

  await verifyContract(hre, "DIAAdapterFactory", factoryDeployment.address, factoryArgs);

  // --- 3. Deploy and Register Adapters ---
  log(`\n  > Step 3: Deploying and registering oracle adapters...`);
  const diaAdapterFactory = (await ethers.getContractAt(
    "DIAAdapterFactory",
    factoryDeployment.address,
    signer,
  )) as DIAAdapterFactory;

  const aggregator = (await ethers.getContractAt(
    "MultiOracleAggregator",
    aggregatorInstance.address,
    signer,
  )) as MultiOracleAggregator;

  const adaptersToDeploy = [
    { base: ethers.getAddress(WETH_ADDRESS), quote: ethers.getAddress(USDC_ADDRESS), key: "WETH/USD" },
    { base: ethers.getAddress(USDC_ADDRESS), quote: ethers.getAddress(WETH_ADDRESS), key: "USDC/USD" },
  ];

  for (const adapter of adaptersToDeploy) {
    log(`    - Processing adapter for ${adapter.key}...`);

    // PASO 3.A: El factory solo CREA el adapter
    const deployTx = await diaAdapterFactory.deployAdapter(adapter.base, adapter.quote, adapter.key);
    log(`      > Deploy Tx sent: ${deployTx.hash}. Waiting for confirmation...`);
    const receipt = await deployTx.wait();

    if (!receipt) {
      throw new Error(`Transaction to deploy adapter for ${adapter.key} failed to be mined.`);
    }

    // PASO 3.B: Encontrar y PARSEAR el evento
    log(`      > Finding and parsing AdapterCreated event...`);

    const eventLog = receipt.logs.find(log => {
      try {
        const parsedLog = diaAdapterFactory.interface.parseLog(log as any);
        return parsedLog?.name === "AdapterCreated";
      } catch {
        return false;
      }
    });

    if (!eventLog) {
      throw new Error(`Could not find AdapterCreated event log for ${adapter.key}`);
    }

    const parsedEvent = diaAdapterFactory.interface.parseLog(eventLog as any);

    if (!parsedEvent) {
      throw new Error(`Failed to parse AdapterCreated event for ${adapter.key}`);
    }

    const newAdapterAddress = parsedEvent.args.adapter;
    log(`      ✅ Adapter for ${adapter.key} deployed at: ${newAdapterAddress}`);

    // PASO 3.C: TU BILLETERA (el owner) REGISTRA el nuevo adapter
    log(`      > Registering new adapter with the Aggregator...`);
    const registerTx = await aggregator.addOracle(adapter.base, adapter.quote, newAdapterAddress);
    log(`        > Register Tx sent: ${registerTx.hash}. Waiting for confirmation...`);
    await registerTx.wait();
    log(`        ✅ Adapter successfully registered.`);

    log(`      > Verifying new adapter contract on block explorer...`);
    const constructorArgs = [DIA_ORACLE_ADDRESS, adapter.base, adapter.quote, adapter.key];
    await verifyContract(hre, "DIAOracleAdapter", newAdapterAddress, constructorArgs);
  }

  log(`----------------------------------------------------\n`);
};
export default func;
func.tags = ["DIA_Arbitrum_Setup"];
func.dependencies = ["MultiOracleAggregatorInstance"];
