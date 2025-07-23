import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Environment, resolveEnvironment, getEnvironmentName } from "../helpers/environment";
import { verifyContract } from "../helpers/verify";

/*─────────────────────────────────────────────────────────
│  CONFIG BY NETWORK
└─────────────────────────────────────────────────────────*/

type ConfigParams = {
  oracleSigner: string;
};

const CONFIGS: Record<string, ConfigParams> = {
  31337: {
    oracleSigner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // Dev key
  },
  84532: {
    oracleSigner: process.env.ORACLE_SIGNER_BASE_SEPOLIA ?? "", // base-sepolia signer
  },
  421614: {
    oracleSigner: process.env.ORACLE_SIGNER_ARB_SEPOLIA ?? "", // arbitrum-sepolia signer
  },
  534351: {
    oracleSigner: process.env.ORACLE_SIGNER_SCR_SEPOLIA ?? "", // scroll-sepolia signer
  },
  1: {
    oracleSigner: process.env.ORACLE_SIGNER_MAINNET ?? "", // mainnet key (from env)
  },
};

/*─────────────────────────────────────────────────────────
│  DEPLOY SCRIPT
└─────────────────────────────────────────────────────────*/

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, getChainId, ethers } = hre;
  const { deploy, getOrNull, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // Verifica si ya existe una EntryPoint desplegada
  const forceRedeploy = process.env.REDEPLOY_GASXCONFIG === "true";
  if (!forceRedeploy) {
    const existing = await getOrNull("GasXConfig");
    if (existing) {
      log(`⚠️  GasXConfig already deployed at ${existing.address}, skipping...`);
      return;
    }
  }

  const chainId = await getChainId();
  const cfg = CONFIGS[chainId!];
  if (!cfg) throw new Error(`❌ GasXConfig.sol params not defined for chainId ${chainId}`);

  // **IMPROVEMENT: Validate the signer address before deployment**
  if (!ethers.isAddress(cfg.oracleSigner)) {
    throw new Error(
      `❌ Invalid oracleSigner address for chainId ${chainId}: "${cfg.oracleSigner}". Check your .env file.`,
    );
  }

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
