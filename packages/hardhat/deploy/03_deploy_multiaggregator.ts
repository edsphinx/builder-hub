import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { resolveEnvironment, getEnvironmentName } from "../helpers/environment";

/**
 * @notice Despliega la implementación lógica de MultiOracleAggregator como contrato base sin inicializar.
 * @dev Puedes forzar el redeploy con `REDEPLOY_MULTI_ORACLE=true`.
 * @param hre Hardhat Runtime Environment injectado por `hardhat-deploy`.
 * @returns Promesa que se resuelve cuando el contrato se despliega.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const artifactName = "MultiOracleAggregator";
  const forceRedeploy = process.env.REDEPLOY_MULTI_ORACLE === "true";

  if (!forceRedeploy) {
    const existing = await deployments.getOrNull(artifactName);
    if (existing) {
      log(`⚠️ ${artifactName} ya desplegado en ${existing.address}`);
      log(`ℹ️ Usa REDEPLOY_MULTI_ORACLE=true para forzar redeploy`);
      return;
    }
  }

  const environment = resolveEnvironment(network.name);
  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));

  log(`🌐 Environment: ${getEnvironmentName(environment)} (${network.name}, chainId ${chainId})`);
  log(`🚀 Deployed logic of ${artifactName} as base contract (without initialize)…`);

  const res = await deploy(artifactName, {
    from: deployer,
    args: [], // Sin argumentos, ya que el proxy lo inicializa luego
    log: true,
  });

  log(`✅ ${artifactName} (implementación lógica) desplegado en: ${res.address}`);
};

export default func;
func.tags = ["MultiOracleAggregator"];
