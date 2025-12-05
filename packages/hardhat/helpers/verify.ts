import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function verifyContract(
  hre: HardhatRuntimeEnvironment,
  name: string,
  address: string,
  constructorArguments: any[],
) {
  const { network } = hre;

  if (network.name === "hardhat" || network.name === "localhost") {
    return; // Skip verification on local networks
  }

  console.log(`\n[VERIFY] Verifying ${name} on ${network.name}...`);

  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments,
    });
    console.log(`[OK] ${name} verified successfully.`);
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log(`[INFO] ${name} is already verified.`);
    } else {
      console.error(`[ERROR] Failed to verify ${name}:`, error.message);
    }
  }
}
