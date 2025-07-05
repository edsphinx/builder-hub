import { ethers } from "hardhat";
import { WalletFuelConfig } from "../typechain-types";

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name} (${network.chainId})`);
  console.log(`🔑 Signer: ${signer.address}`);

  // === Reemplaza con la dirección del contrato Config desplegado en tu red
  const CONFIG_ADDRESS = "0xYourDeployedConfigAddressHere";
  const config = (await ethers.getContractAt("Config", CONFIG_ADDRESS)) as WalletFuelConfig;

  // === Define aquí los selectores y límites en USD (6 decimales)
  const entries: { selector: string; maxUsd: string }[] = [
    {
      selector: "0xa9059cbb", // transfer(address,uint256)
      maxUsd: "10", // $10.00
    },
    {
      selector: "0x23b872dd", // transferFrom(address,address,uint256)
      maxUsd: "5", // $5.00
    },
    // Agregá más aquí ⬇
  ];

  for (const { selector, maxUsd } of entries) {
    const usdAmount = ethers.parseUnits(maxUsd, 6); // 6 decimales
    const tx = await config.setMaxUsd(selector as `0x${string}`, usdAmount);
    console.log(`📝 Setting ${maxUsd} USDC for selector ${selector}...`);
    await tx.wait();
    console.log(`✅ Done. txHash: ${tx.hash}`);
  }
}

main().catch(err => {
  console.error("❌ Error setting limits:", err);
  process.exit(1);
});
