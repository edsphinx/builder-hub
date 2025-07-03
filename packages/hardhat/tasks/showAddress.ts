import { task } from "hardhat/config";
import { DEPLOYED_ADDRESSES } from "../helpers/addresses";

task("show-address", "Muestra la dirección desplegada de un contrato")
  .addParam("contract", "Nombre del contrato (WalletFuel | Config)")
  .setAction(async (args, hre) => {
    const { contract } = args;
    const chainId = hre.network.config.chainId;

    if (!chainId) {
      throw new Error("Chain ID no detectado");
    }

    const chainIdStr = String(chainId);
    const addressMap = DEPLOYED_ADDRESSES[contract as keyof typeof DEPLOYED_ADDRESSES];

    if (!addressMap) {
      throw new Error(`Contrato inválido: ${contract}`);
    }

    const addr = addressMap[chainIdStr as keyof typeof addressMap];
    if (!addr) {
      throw new Error(`No hay dirección registrada para ${contract} en chainId ${chainIdStr}`);
    }

    console.log(`📍 ${contract} en ${hre.network.name} [${chainIdStr}]: ${addr}`);
  });
