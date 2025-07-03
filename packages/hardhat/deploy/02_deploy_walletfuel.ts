import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { resolveEnvironment, getEnvironmentName, Environment } from "../helpers/environment";

/*─────────────────────────────────────────────────────────
│  CONFIGURACIÓN POR RED
└─────────────────────────────────────────────────────────*/

type NetworkConfig = {
  entryPoint: string; // Dirección EntryPoint 0.8 (o la que necesites)
  stakeEth: string; // ETH bloqueado como stake
  depositEth: string; // ETH para pagar gas de las UserOps
  paymasterOwner?: string; // (opcional) propietario distinto al deployer
};

// 1)  Usa la misma dirección EntryPoint 0.8 en todas las redes modernas.
// 2)  Si alguna red aún va con 0.6, especifica aquí la dirección legacy.
const CONFIG: Record<number, NetworkConfig> = {
  // ┌──────── chainId (hex/dec)
  31337: {
    // hardhat local
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    stakeEth: "0.01",
    depositEth: "0.05",
  },
  84532: {
    // base sepolia
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    stakeEth: "0.1",
    depositEth: "0.2",
  },
  421614: {
    // arbitrum sepolia
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    stakeEth: "0.1",
    depositEth: "0.2",
  },
  // Agrega más redes aquí ⬇
  1: {
    // mainnet
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    stakeEth: "1",
    depositEth: "2",
    paymasterOwner: process.env.PAYMASTER_OWNER ?? "", // multisig
  },
};

/*─────────────────────────────────────────────────────────
│   DEPLOY
└─────────────────────────────────────────────────────────*/

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  /* ── 1. Recupera la dirección del EntryPoint recién desplegado ── */
  //    Si la carpeta deployments ya la tiene (porque se ejecutó 00_entrypoint.ts),
  //    `get()` la lee sin volver a compilar.
  const epDeployment = await get("EntryPoint");
  const entryPointAddress = epDeployment.address;

  /* ── 2. Elige la config por chainId (con fallback al RPC) ── */
  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  const cfg = CONFIG[chainId!];
  if (!cfg) {
    throw new Error(`❌ Configuración no definida para chainId ${chainId}`);
  }

  log(`📡 Deploying to ${network.name} (chainId ${network.config.chainId})`);

  log(`↳ Deploying WalletFuel - Gasless Paymaster on chain ${chainId}`);
  log(`   Using EntryPoint at ${entryPointAddress}`);

  /* ── 3. Determina el entorno (Environment enum en Solidity) ── */
  // Mapea automáticamente la red al entorno adecuado
  // const environment = resolveEnvironment(network.name);
  const environment: Environment = resolveEnvironment(network.name);
  log(`🌐 Environment: ${getEnvironmentName(environment)}`);

  /* ── 4. Despliega el Paymaster con constructor extendido y usando la dirección obtenida ── */
  const res = await deploy("WalletFuel", {
    from: deployer,
    args: [
      entryPointAddress,
      ethers.ZeroAddress, // ← reemplazar luego con configAddress real
      cfg.paymasterOwner || deployer,
      environment, // 👈 nuevo argumento
    ],
    log: true,
  });

  log(`✅ WalletFuel - Gasless Paymaster @ ${res.address}`);

  /* ── 5. Fondea el Paymaster, Fondea con stake y depósito ── */
  const paymaster = await hre.ethers.getContractAt("WalletFuel", res.address);

  await paymaster.addStake(24 * 60 * 60, {
    // 1 día
    value: ethers.parseEther(cfg.stakeEth),
  });
  await paymaster.deposit({
    value: ethers.parseEther(cfg.depositEth),
  });

  log(`💰 Stake ${cfg.stakeEth} ETH · Depósito ${cfg.depositEth} ETH añadidos`);
  log(`✅ WalletFuel - Gasless Paymaster deployed @ ${res.address}`);
};

export default func;
func.tags = ["WalletFuel"];
func.dependencies = ["EntryPoint"]; // ← asegura que 00_entrypoint se ejecute antes
