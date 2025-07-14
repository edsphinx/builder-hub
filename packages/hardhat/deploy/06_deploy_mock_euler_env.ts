// 06_deploy_mock_euler_env.ts
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("🚀 Deploying Mock Tokens...");

  const weth = await deploy("MockERC20_WETH", {
    contract: "MockERC20",
    from: deployer,
    args: ["Wrapped Ether", "WETH", 18],
    log: true,
  });

  const usdc = await deploy("MockERC20_USDC", {
    contract: "MockERC20",
    from: deployer,
    args: ["USD Coin", "USDC", 6],
    log: true,
  });

  log("✅ Mock Tokens deployed:");
  log(`- WETH: ${weth.address}`);
  log(`- USDC: ${usdc.address}`);

  log("🚀 Deploying MockEulerOracle...");

  const price = ethers.parseUnits("3000", 18); // 1 WETH = 3000 USDC
  const oracle = await deploy("MockEulerOracle", {
    from: deployer,
    args: [price],
    log: true,
  });

  log(`✅ MockEulerOracle deployed at ${oracle.address}`);

  log("🧩 Deploying EulerOracleAdapter...");

  const adapter = await deploy("EulerOracleAdapterInstance", {
    contract: "EulerOracleAdapter",
    from: deployer,
    args: [oracle.address, weth.address, usdc.address],
    log: true,
  });

  log(`✅ EulerOracleAdapter deployed at ${adapter.address}`);
};

func.skip = async hre => {
  const { network } = hre;
  return network.name !== "localhost" && network.name !== "hardhat";
};
export default func;
func.tags = ["MockEulerEnv"];
