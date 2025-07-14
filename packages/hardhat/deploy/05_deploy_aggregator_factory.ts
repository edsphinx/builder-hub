// 05_deploy_aggregator_factory.ts
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

/**
 * @notice Despliega AggregatorFactory con referencia a MultiOracleAggregatorInstance como lógica.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, getOrNull, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const factoryName = "AggregatorFactory";
  const implementationName = "MultiOracleAggregatorInstance";
  const forceRedeploy = process.env.REDEPLOY_AGGREGATOR_FACTORY === "true";

  // Verificación explícita de que la implementación ya fue desplegada
  const implementation = await getOrNull(implementationName);
  if (!implementation || !ethers.isAddress(implementation.address) || implementation.address === ethers.ZeroAddress) {
    throw new Error(
      `❌ No se encontró implementación válida para ${implementationName}. Ejecuta 04_deploy_multiaggregator_proxy.ts primero.`,
    );
  }

  if (!forceRedeploy) {
    const existing = await getOrNull(factoryName);
    if (existing) {
      log(`⚠️ ${factoryName} ya desplegado en ${existing.address}`);
      log(`ℹ️ Usa REDEPLOY_AGGREGATOR_FACTORY=true para forzar redeploy`);
      return;
    }
  }

  log(`🚀 Desplegando ${factoryName} apuntando a ${implementationName} (${implementation.address})…`);

  const result = await deploy(factoryName, {
    from: deployer,
    args: [implementation.address],
    log: true,
  });

  log(`✅ ${factoryName} desplegado en: ${result.address}`);
};

export default func;
func.tags = ["AggregatorFactory"];
func.dependencies = ["MultiOracleAggregatorInstance"];
