import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const entryPoint = await hre.deployments.get("EntryPoint");

  const res = await deploy("SimpleAccountFactory", {
    from: deployer,
    args: [entryPoint.address],
    log: true,
    contract: "@account-abstraction/contracts/accounts/SimpleAccountFactory.sol:SimpleAccountFactory",
  });

  log(`✅ SimpleAccountFactory deployed @ ${res.address}`);
};

export default func;
func.tags = ["SimpleAccountFactory"];
