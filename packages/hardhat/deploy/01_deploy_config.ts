import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Environment, resolveEnvironment, getEnvironmentName } from "../helpers/environment";
import { verifyContract } from "../helpers/verify";

/*─────────────────────────────────────────────────────────
│  CONFIG POR RED
└─────────────────────────────────────────────────────────*/

type ConfigParams = {
  oracleSigner: string;
};

const CONFIGS: Record<number, ConfigParams> = {
  31337: {
    oracleSigner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // Dev key
  },
  84532: {
    oracleSigner: "0x...", // base-sepolia signer
  },
  421614: {
    oracleSigner: "0x...", // arbitrum-sepolia signer
  },
  534351: {
    oracleSigner: "0x19d400d79AC12eBa630fC1fa998f8bD0f08cc5f6", // scroll-sepolia signer
  },
  1: {
    oracleSigner: process.env.ORACLE_SIGNER ?? "", // mainnet key (from env)
  },
};

/*─────────────────────────────────────────────────────────
│  DEPLOY SCRIPT
└─────────────────────────────────────────────────────────*/

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, getOrNull, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // Verifica si ya existe una EntryPoint desplegada
  const existing = await getOrNull("WalletFuelConfig");
  if (existing) {
    log(`⚠️  WalletFuelConfig already deployed at ${existing.address}, skipping...`);
    return;
  }

  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  const cfg = CONFIGS[chainId!];
  if (!cfg) throw new Error(`❌ WalletFuelConfig.sol params not defined for chainId ${chainId}`);

  const env: Environment = resolveEnvironment(network.name);
  log(`🌐 Environment: ${getEnvironmentName(env)} (chainId: ${chainId})`);
  log(`🔐 Oracle signer: ${cfg.oracleSigner}`);

  const res = await deploy("GasXConfig", {
    from: deployer,
    args: [cfg.oracleSigner],
    log: true,
  });

  log(`✅ GasXConfig.sol deployed @ ${res.address}`);

  await verifyContract(hre, "GasXConfig", res.address, [cfg.oracleSigner]);
};

export default func;
func.tags = ["GasXConfig"];
