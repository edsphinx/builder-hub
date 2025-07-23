import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { verifyContract } from "../helpers/verify";

/**
 * @notice Despliega una instancia inicializable (proxy UUPS) de MultiOracleAggregator.
 * @dev Usa la lógica previamente desplegada por 03_deploy_multiaggregator.ts.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const log = deployments.log;

  const artifactName = "MultiOracleAggregator";
  const proxyName = "MultiOracleAggregatorInstance";
  const forceRedeploy = process.env.REDEPLOY_MULTI_AGGREGATOR === "true";

  if (!forceRedeploy) {
    const existing = await deployments.getOrNull(proxyName);
    if (existing) {
      log(`⚠️ ${proxyName} ya desplegado en ${existing.address}`);
      log(`ℹ️ Usa REDEPLOY_MULTI_AGGREGATOR=true para forzar redeploy`);
      return;
    }
  }

  const maxDeviationBps = 300; // 3% máximo de desviación

  log(`🚀 Desplegando proxy UUPS de ${artifactName} (como ${proxyName})…`);
  const factory = await ethers.getContractFactory(artifactName);

  const instance = await upgrades.deployProxy(factory, [deployer, maxDeviationBps], {
    kind: "uups",
    initializer: "initialize",
  });

  await instance.waitForDeployment();
  const addr = await instance.getAddress();

  // 🔐 Registrar en el sistema de deployments
  await deployments.save(proxyName, {
    abi: (await deployments.getArtifact(artifactName)).abi,
    address: addr,
  });

  log(`✅ ${proxyName} desplegado en: ${addr}`);

  await verifyContract(hre, artifactName, addr, [deployer, maxDeviationBps]);
};

export default func;
func.tags = ["MultiOracleAggregatorInstance"];
func.dependencies = ["MultiOracleAggregator"];
