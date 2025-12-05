import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { verifyContract } from "../helpers/verify";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";
import { networkConfigs } from "../config/networks";
import { entryPoint08Address } from "viem/account-abstraction";

/**
 * @notice Deploys the GasXWhitelistPaymaster contract.
 * @dev This script deploys the primary sponsorship paymaster, configuring it with
 * the correct EntryPoint, config, and treasury addresses for the target network.
 * It also supports optional, flag-based funding of the paymaster's stake and deposit.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log, get, getOrNull } = deployments; // Added getOrNull
  const { deployer } = await getNamedAccounts();

  const artifactName = "GasXWhitelistPaymaster";
  const forceRedeploy = process.env.REDEPLOY_ALL === "true" || process.env.REDEPLOY_GASX_WHITELIST_PAYMASTER === "true";

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId?.toString() ?? (await hre.getChainId());
  log(`\n🛰️  Deploying: ${artifactName}`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Deployer:    ${deployer}`);
  log(`----------------------------------------------------`);

  // --- Configuration & Validation ---
  const cfg = networkConfigs[chainId];
  if (!cfg) {
    throw new Error(`❌ Configuration not found for chainId ${chainId} in config/networks.ts`);
  }

  const isLocalNetwork = network.name === "hardhat" || network.name === "localhost";

  // Robustly get GasXConfig address
  const configDeployment = await getOrNull("GasXConfig");
  if (!configDeployment) {
    throw new Error("❌ GasXConfig deployment not found. Please deploy it first.");
  }
  const configAddress = configDeployment.address;

  const entryPointAddress = isLocalNetwork ? (await get("EntryPoint")).address : entryPoint08Address;
  const treasuryAddress = cfg.treasury || deployer;
  const environment = resolveEnvironment(network.name);

  log("\n  > Verifying contract arguments...");
  if (!ethers.isAddress(entryPointAddress) || entryPointAddress === ethers.ZeroAddress) {
    throw new Error(`❌ Invalid EntryPoint address for network ${network.name}`);
  }
  if (!ethers.isAddress(configAddress) || configAddress === ethers.ZeroAddress) {
    throw new Error(`❌ Invalid GasXConfig address found: ${configAddress}`);
  }
  log(`    ✅ EntryPoint: ${entryPointAddress}`);
  log(`    ✅ GasXConfig: ${configAddress}`);
  log(`    ✅ Treasury:   ${treasuryAddress}`);

  // --- Deployment ---
  if (!forceRedeploy) {
    const existing = await deployments.getOrNull(artifactName);
    if (existing) {
      log(`⚠️  ${artifactName} already deployed at ${existing.address}.`);
      log(`ℹ️  To force redeploy, set the relevant REDEPLOY flag to true.`);
      return;
    }
  }

  const deployResult = await deploy(artifactName, {
    from: deployer,
    args: [entryPointAddress, configAddress, treasuryAddress, environment],
    log: true,
  });

  log(`✅ ${artifactName} deployed at: ${deployResult.address}`);

  // --- Enable Dev Mode ONLY for local networks (hardhat/localhost) ---
  // Dev mode bypasses oracle signature validation for easier testing
  // Testnets are treated as production environments for security
  const paymaster = await hre.ethers.getContractAt(artifactName, deployResult.address);
  if (isLocalNetwork) {
    log(`\n🔧 Enabling Dev Mode for local development...`);
    await (await paymaster.setDevMode(true)).wait();
    log(`    ✅ Dev Mode enabled.`);
  } else {
    log(`\n🔒 ${envName} environment detected. Dev Mode remains disabled for security.`);
  }

  // --- Optional Funding ---
  const shouldFund = process.env.FUND_ON_DEPLOY === "true";
  if (shouldFund) {
    if (cfg.stakeEth && cfg.depositEth) {
      log(`\n💰 Funding Paymaster (requested via FUND_ON_DEPLOY=true)...`);
      const paymaster = await hre.ethers.getContractAt(artifactName, deployResult.address);
      const UNSTAKE_DELAY_SEC = 86400; // 24 hours

      log(`  > Staking ${cfg.stakeEth} ETH...`);
      await (await paymaster.addStake(UNSTAKE_DELAY_SEC, { value: ethers.parseEther(cfg.stakeEth) })).wait();
      log(`    ✅ Stake completed.`);

      log(`  > Depositing ${cfg.depositEth} ETH...`);
      await (await paymaster.deposit({ value: ethers.parseEther(cfg.depositEth) })).wait();
      log(`    ✅ Deposit completed.`);
    } else {
      log(`\n⚠️  FUND_ON_DEPLOY=true, but 'stakeEth' or 'depositEth' are not defined in the config for this network.`);
    }
  } else {
    log(`\nℹ️  Funding skipped. To fund on deploy, set FUND_ON_DEPLOY=true in your .env file.`);
  }

  // --- Verification ---
  await verifyContract(hre, artifactName, deployResult.address, deployResult.args || []);
  log(`----------------------------------------------------\n`);
};

export default func;
func.tags = ["GasXWhitelistPaymaster"];
func.dependencies = ["GasXConfig"];
func.skip = async (hre: HardhatRuntimeEnvironment) => {
  func.dependencies = func.dependencies ?? [];
  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    func.dependencies.push("EntryPoint");
  }
  return false;
};
