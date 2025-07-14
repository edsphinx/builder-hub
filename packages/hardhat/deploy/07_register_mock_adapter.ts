// 07_register_mock_adapter.ts
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const { log, get } = deployments;

  log("🔗 Obteniendo direcciones...");

  const aggregatorDeployment = await get("MultiOracleAggregatorInstance");
  const adapterDeployment = await get("EulerOracleAdapterInstance");
  const baseToken = (await get("MockERC20_WETH")).address;
  const quoteToken = (await get("MockERC20_USDC")).address;

  const aggregator = await ethers.getContractAt("MultiOracleAggregator", aggregatorDeployment.address);

  log("🧠 Agregando adaptador a MultiOracleAggregator...");

  const tx = await aggregator.addOracle(baseToken, quoteToken, adapterDeployment.address);
  await tx.wait();

  log(`✅ Adaptador ${adapterDeployment.address} registrado para el par ${baseToken}/${quoteToken}`);
};

func.skip = async hre => {
  const { network } = hre;
  return network.name !== "localhost" && network.name !== "hardhat";
};
export default func;
func.tags = ["RegisterMockAdapter"];
