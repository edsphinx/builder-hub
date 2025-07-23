import { ethers } from "hardhat";

async function main() {
  const PROXY_ADDRESS = "0xA2DBD21e3f7A038a1fAE1Ff0a3137b5c81c4EBae"; // ¡Usa la dirección de tu proxy!

  console.log(`Verificando la versión del contrato en la dirección del proxy: ${PROXY_ADDRESS}`);

  // Conecta con el proxy usando la ABI del contrato V2
  // Asegúrate de que MultiOracleAggregatorV2 tenga la ABI de las funciones V1 y V2.
  const aggregatorV2 = await ethers.getContractAt("MultiOracleAggregatorV2", PROXY_ADDRESS);

  try {
    const version = await aggregatorV2.version();
    console.log(`La función version() devuelve: ${version}`);
    if (version === "V2") {
      console.log("¡Confirmado! El proxy está utilizando la lógica de V2.");
    } else {
      console.log("El proxy NO está utilizando la lógica de V2 o la función version() no devuelve 'V2'.");
    }
  } catch (error) {
    console.error("Error al llamar a version():", error);
    console.error("Esto podría indicar que la función version() no existe en la implementación actual del proxy.");
  }

  // También puedes verificar una función V1 para confirmar que el estado se mantuvo
  // Por ejemplo, si tienes una función 'owner()'
  try {
    const owner = await aggregatorV2.owner();
    console.log(`El propietario actual del proxy es: ${owner}`);
  } catch (error) {
    console.error("Error al llamar a owner():", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
