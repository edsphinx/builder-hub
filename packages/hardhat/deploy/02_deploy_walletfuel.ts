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
  534351: {
    // scroll sepolia
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    stakeEth: "0.1",
    depositEth: "0.2",
  },
  1: {
    // mainnet
    entryPoint: "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
    stakeEth: "1",
    depositEth: "2",
    paymasterOwner: process.env.PAYMASTER_OWNER || undefined, // multisig
  },
};

/*─────────────────────────────────────────────────────────
│   DEPLOY
└─────────────────────────────────────────────────────────*/

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const forceRedeploy = process.env.REDEPLOY_WALLETFUEL === "true";

  if (!forceRedeploy) {
    const existing = await hre.deployments.getOrNull("WalletFuel");
    if (existing) {
      log(`⚠️ WalletFuel ya desplegado en ${existing.address}`);
      log(`ℹ️ Para forzar el redeploy, seteá REDEPLOY_WALLETFUEL=true en tu .env o en el comando CLI`);
      return;
    }
  }

  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  const cfg = CONFIG[chainId!];
  if (!cfg) {
    throw new Error(`❌ Configuración no definida para chainId ${chainId}`);
  }

  const configAddress = (await get("WalletFuelConfig")).address;
  let entryPointAddress: string;

  if (network.name === "hardhat" || network.name === "localhost") {
    // En local, dependemos del despliegue de 00_deploy_entrypoint.ts
    entryPointAddress = (await get("EntryPoint")).address;
  } else {
    // En redes públicas, usamos la dirección hardcodeada y verificada de la config.
    entryPointAddress = cfg.entryPoint;
  }

  // Verificación de seguridad: Asegurarnos de que la dirección es válida antes de continuar.
  if (!ethers.isAddress(entryPointAddress) || entryPointAddress === ethers.ZeroAddress) {
    throw new Error(`❌ EntryPoint inválido o no configurado para la red ${network.name}`);
  }

  if (!ethers.isAddress(configAddress) || configAddress === ethers.ZeroAddress) {
    throw new Error("❌ WalletFuelConfig inválido");
  }

  const environment: Environment = resolveEnvironment(network.name);
  const isLocal = chainId === 31337 || network.name.includes("hardhat");
  const isTestnet = [84532, 421614].includes(chainId); // o usá un helper si tenés uno
  const isMainnet = chainId === 1;
  const doStake = !!cfg.stakeEth && Number(cfg.stakeEth) > 0;
  const doDeposit = !!cfg.depositEth && Number(cfg.depositEth) > 0;

  log(`🌐 Entorno: ${getEnvironmentName(environment)} (${network.name}, chainId ${chainId})`);
  log(`⛽ EntryPoint: ${entryPointAddress}`);
  log(`🧩 WalletFuelConfig: ${configAddress}`);

  const res = await deploy("WalletFuel", {
    from: deployer,
    args: [
      entryPointAddress,
      configAddress, // ← WalletFuelConfig address
      cfg.paymasterOwner || deployer,
      environment, // 👈 nuevo argumento
    ],
    log: true,
  });

  log(`✅ WalletFuel desplegado en: ${res.address}`);
  if (cfg.paymasterOwner) {
    log(`⚠️  Owner: ${cfg.paymasterOwner}`);
  }

  if (isLocal || isTestnet) {
    if (isLocal && (doStake || doDeposit)) {
      const paymaster = await hre.ethers.getContractAt("WalletFuel", res.address);

      if (doStake) {
        await paymaster.addStake(24 * 60 * 60, {
          value: ethers.parseEther(cfg.stakeEth),
        });
        log(`💰 Stake: ${cfg.stakeEth} ETH`);
      }

      if (doDeposit) {
        await paymaster.deposit({
          value: ethers.parseEther(cfg.depositEth),
        });
        log(`💰 Depósito: ${cfg.depositEth} ETH`);
      }
    } else if (isTestnet) {
      log(`⚠️  Stake y depósito omitidos temporalmente en testnet por seguridad.`);
    }
  } else if (isMainnet) {
    log(`⚠️  Stake y depósito omitidos en mainnet por seguridad. Ejecuta manualmente si es necesario.`);
    if (isMainnet && !cfg.paymasterOwner) {
      //asegurarse de no hacer un deploy inseguro en mainnet:
      log(`⚠️  Paymaster owner no definido en mainnet. Ejecuta manualmente si es necesario.`);
    }
  }

  await verifyContract(hre, "WalletFuel", res.address, res.args || []);
};

export default func;
func.tags = ["WalletFuel"];
func.dependencies = ["EntryPoint", "WalletFuelConfig"]; // ← asegura que 00_entrypoint y 01_deploy_config se ejecuten antes
