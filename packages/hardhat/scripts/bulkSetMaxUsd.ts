import { ethers } from "hardhat";
import { WalletFuelConfig } from "../typechain-types";

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name} (${network.chainId})`);
  console.log(`🔑 Signer: ${signer.address}`);

  // === Dirección de Config.sol desplegado
  const CONFIG_ADDRESS = "0xYourDeployedConfigAddressHere"; // ← reemplazar
  const config = (await ethers.getContractAt("Config", CONFIG_ADDRESS)) as WalletFuelConfig;

  // === Lista de funciones a configurar
  const selectorMap: Record<string, string> = {
    "0xa9059cbb": "10", // transfer(address,uint256) => $10
    "0x23b872dd": "5", // transferFrom(address,address,uint256) => $5
    // Agregá más: selector → límite en USD
  };

  const selectors = Object.keys(selectorMap) as `0x${string}`[];
  const limits = Object.values(selectorMap).map(v => ethers.parseUnits(v, 6));

  console.log("📝 Bulk setting maxUsd values:");
  selectors.forEach((s, i) => {
    console.log(`  • ${s} => $${Number(ethers.formatUnits(limits[i], 6))}`);
  });

  const tx = await config.bulkSetMaxUsd(selectors, limits);
  console.log("⏳ Waiting for tx...");
  await tx.wait();
  console.log(`✅ Done. txHash: ${tx.hash}`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
