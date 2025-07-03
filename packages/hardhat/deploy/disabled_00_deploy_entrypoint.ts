import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // 1. Despliega EntryPoint v0.8  (no arguments)
  const ep = await deploy("EntryPoint", {
    from: deployer,
    contract: "@account-abstraction/contracts/core/EntryPoint.sol:EntryPoint", // ← FQN
    args: [], // <- constructor vacío
    log: true,
  });

  log(`✅ EntryPoint v0.8 deploy @ ${ep.address}`);

  // 2. Fondea con 0.5 ETH para pruebas locales
  const entryPoint = await ethers.getContractAt("EntryPoint", ep.address);

  await entryPoint.depositTo(ep.address, {
    value: ethers.parseEther("0.5"),
  });

  log("📥 Deposit 0.5 ETH added to EntryPoint");
};

// export default func;
func.tags = ["EntryPoint"];
