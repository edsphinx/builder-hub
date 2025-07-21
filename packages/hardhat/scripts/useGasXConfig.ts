import hre from "hardhat";
import { getAddress } from "../helpers/addresses";

async function main() {
  const chainId = hre.network.config.chainId!;
  const configAddress = getAddress("GasXConfig", chainId);
  const config = await hre.ethers.getContractAt("GasXConfig", configAddress);

  const signer = await config.oracleSigner();
  console.log(`🔍 Oracle signer is: ${signer}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
