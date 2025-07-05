import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { WalletFuelConfig } from "../typechain-types";

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name} (${network.chainId})`);
  console.log(`🔑 Signer: ${signer.address}`);

  const CONFIG_ADDRESS = "0xYourDeployedConfigAddressHere"; // ← actualizá esto
  const config = (await ethers.getContractAt("Config", CONFIG_ADDRESS)) as WalletFuelConfig;

  // === Carga JSON de selectors
  const filePath = path.join(__dirname, "../data/selectors.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as Record<string, string>;

  // === Validación básica
  const selectors: `0x${string}`[] = [];
  const amounts: bigint[] = [];

  for (const [selector, usdStr] of Object.entries(data)) {
    if (!/^0x[a-fA-F0-9]{8}$/.test(selector)) {
      throw new Error(`❌ Invalid selector format: ${selector}`);
    }
    const parsed = ethers.parseUnits(usdStr, 6);
    selectors.push(selector as `0x${string}`);
    amounts.push(parsed);
  }

  console.log("📝 Setting maxUsd values from selectors.json:");
  selectors.forEach((s, i) => {
    console.log(`  • ${s} => $${Number(ethers.formatUnits(amounts[i], 6))}`);
  });

  const tx = await config.bulkSetMaxUsd(selectors, amounts);
  console.log("⏳ Waiting for tx...");
  await tx.wait();
  console.log(`✅ Config updated. txHash: ${tx.hash}`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
