import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const res = await deploy("MockTarget", {
    from: deployer,
    args: [],
    log: true,
    contract: "contracts/mocks/MockTarget.sol:MockTarget",
  });

  log(`✅ MockTarget deployed @ ${res.address}`);
};

func.skip = async hre => {
  const { network } = hre;
  return network.name !== "localhost" && network.name !== "hardhat";
};
export default func;
func.tags = ["MockTarget"];
