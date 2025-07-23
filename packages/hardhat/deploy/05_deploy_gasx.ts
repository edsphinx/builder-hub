import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { resolveEnvironment, getEnvironmentName } from "../helpers/environment";
import { verifyContract } from "../helpers/verify";

type NetworkConfig = {
  entryPoint: string;
  stakeEth?: string;
  depositEth?: string;
  treasury?: string;
};

const CONFIG: Record<string, NetworkConfig> = {
  "31337": {
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    stakeEth: "0.01",
    depositEth: "0.05",
    // On local networks, treasury defaults to the deployer
  },
  "84532": {
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    treasury: process.env.PAYMASTER_TREASURY_BASE_SEPOLIA || undefined,
  },
  "421614": {
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    treasury: process.env.PAYMASTER_TREASURY_ARBITRUM_SEPOLIA || undefined,
  },
  "534351": {
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    treasury: process.env.PAYMASTER_TREASURY_SCROLL_SEPOLIA || undefined,
  },
  "1": {
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    treasury: process.env.PAYMASTER_TREASURY_MAINNET || undefined,
  },
};

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, getChainId } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  // SE MANTIENE: Lógica para forzar el redespliegue, estandarizando el nombre.
  const forceRedeploy = process.env.REDEPLOY_GASX === "true";
  if (!forceRedeploy) {
    const existing = await hre.deployments.getOrNull("GasX");
    if (existing) {
      log(`⚠️ GasX already deployed at ${existing.address}.`);
      log(`ℹ️ To force redeploy, set the REDEPLOY_GASX=true environment variable.`);
      return;
    }
  }

  const cfg = CONFIG[chainId];
  if (!cfg) throw new Error(`❌ Configuration not defined for chainId ${chainId}`);

  // IMPROVEMENT: Dependencies are set conditionally to prevent errors on public networks.
  const isLocalNetwork = network.name === "hardhat" || network.name === "localhost";
  if (isLocalNetwork) {
    func.dependencies = ["EntryPoint", "GasXConfig"];
  } else {
    func.dependencies = ["GasXConfig"];
  }

  // --- Address Resolution ---
  const configAddress = (await get("GasXConfig")).address;
  const entryPointAddress = isLocalNetwork ? (await get("EntryPoint")).address : cfg.entryPoint;
  const treasuryAddress = cfg.treasury || deployer;
  const environment = resolveEnvironment(network.name);

  // KEPT: Defensive security checks from original script.
  if (!ethers.isAddress(entryPointAddress) || entryPointAddress === ethers.ZeroAddress) {
    throw new Error(`❌ Dirección de EntryPoint inválida para la red ${network.name}`);
  }
  if (!ethers.isAddress(configAddress) || configAddress === ethers.ZeroAddress) {
    throw new Error("❌ Dirección de GasXConfig inválida");
  }

  // --- Configuration Logging ---
  log("-".repeat(30));
  log(`🛰️  Deploying GasX Paymaster`);
  log(`🌐 Environment: ${getEnvironmentName(environment)} (chainId: ${chainId})`);
  log(`⛽ EntryPoint: ${entryPointAddress}`);
  log(`🧩 GasXConfig: ${configAddress}`);
  log(`🏦 Treasury: ${treasuryAddress}`);
  log("-".repeat(30));

  // --- Deployment ---
  const res = await deploy("GasX", {
    from: deployer,
    args: [entryPointAddress, configAddress, treasuryAddress, environment],
    log: true,
  });

  log(`✅ GasX deployed at: ${res.address}`);

  // IMPROVEMENT: Explicit and safe funding for any network, not just local.
  const shouldFund = process.env.FUND_ON_DEPLOY === "true";
  if (shouldFund) {
    if (cfg.stakeEth && cfg.depositEth) {
      log(`💰 Funding Paymaster (requested via FUND_ON_DEPLOY=true)`);
      const paymaster = await hre.ethers.getContractAt("GasX", res.address);
      const UNSTAKE_DELAY_SEC = 86400; // 24 horas

      await (await paymaster.addStake(UNSTAKE_DELAY_SEC, { value: ethers.parseEther(cfg.stakeEth) })).wait();
      log(`   - Stake of ${cfg.stakeEth} ETH completed.`);

      await (await paymaster.deposit({ value: ethers.parseEther(cfg.depositEth) })).wait();
      log(`   - Deposit of ${cfg.depositEth} ETH completed.`);
    } else {
      log(`⚠️  FUND_ON_DEPLOY=true, but stakeEth or depositEth are not defined in the config for this network.`);
    }
  } else {
    log(`ℹ️  Funding skipped. To fund, use the FUND_ON_DEPLOY=true environment variable.`);
  }

  // --- Verification ---
  await verifyContract(hre, "GasX", res.address, res.args || []);
};

export default func;
func.tags = ["GasX"];
