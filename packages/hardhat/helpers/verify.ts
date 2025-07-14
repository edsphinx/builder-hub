import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function verifyContract(
  hre: HardhatRuntimeEnvironment,
  name: string,
  address: string,
  constructorArguments: any[],
) {
  const { network } = hre;

  if (network.name === "hardhat" || network.name === "localhost") {
    return; // No verificar en redes locales
  }

  console.log(`
Verificando ${name} en ${network.name}...
`);

  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments,
    });
    console.log(`✅ ${name} verificado exitosamente.`);
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log(`ℹ️ ${name} ya está verificado.`);
    } else {
      console.error(`❌ Error al verificar ${name}:`, error);
    }
  }
}
