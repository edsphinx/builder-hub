// packages/hardhat/deploy/98_deploy_mock_oracle.ts

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // Safety guard: Only deploy mocks on local or test networks
  if (network.name === "mainnet" || network.name === "production") {
    log("🚫 MockOracle not deployed on mainnet.");
    return;
  }

  // The MockOracle constructor needs an initial price.
  // We'll set a default of $3000 with 18 decimals.
  const initialPrice = ethers.parseEther("3000");

  await deploy("MockOracle", {
    from: deployer,
    args: [initialPrice],
    log: true,
  });

  log(`✅ MockOracle deployed.`);
};

export default func;
// This tag is the key to deploying this script individually.
func.tags = ["MockOracle"];
