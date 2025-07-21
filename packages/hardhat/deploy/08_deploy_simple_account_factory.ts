import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { entryPoint08Address } from "viem/account-abstraction";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  let entryPointAddress: string;

  if (network.name === "hardhat" || network.name === "localhost") {
    const entryPoint = await hre.deployments.get("EntryPoint");
    entryPointAddress = entryPoint.address;
  } else {
    entryPointAddress = entryPoint08Address;
  }

  const res = await deploy("SimpleAccountFactory", {
    from: deployer,
    args: [entryPointAddress],
    log: true,
    contract: "@account-abstraction/contracts/accounts/SimpleAccountFactory.sol:SimpleAccountFactory",
  });

  log(`✅ SimpleAccountFactory deployed @ ${res.address}`);
};

export default func;
func.tags = ["SimpleAccountFactory"];
func.dependencies = ["EntryPoint"]; // Asegura que EntryPoint se despliegue primero en local
