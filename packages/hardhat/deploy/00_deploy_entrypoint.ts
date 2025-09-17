import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { network } from "hardhat";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  if (network.name !== "hardhat" && network.name !== "localhost") {
    log("Not on a local network, skipping EntryPoint deployment");
    return;
  }

  // Define the Fully Qualified Name for EntryPoint
  const ENTRYPOINT_FQN = "@account-abstraction/contracts/core/EntryPoint.sol:EntryPoint";

  // 1. Despliega EntryPoint v0.8 (si no existe)
  const ep = await deploy("EntryPoint", {
    from: deployer,
    contract: ENTRYPOINT_FQN, // ← FQN
    args: [], // <- constructor vacío
    log: true,
  });

  log(`✅ EntryPoint v0.8 deploy @ ${ep.address}`);

  // 2. Fondea con 0.5 ETH para pruebas locales
  const entryPoint = await ethers.getContractAt(ENTRYPOINT_FQN, ep.address);

  await entryPoint.depositTo(ep.address, {
    value: ethers.parseEther("0.5"),
  });

  log("📥 Deposit 0.5 ETH added to EntryPoint");
};

export default func;
func.tags = ["EntryPoint"];
