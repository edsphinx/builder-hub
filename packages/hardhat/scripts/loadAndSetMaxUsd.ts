import { ethers, deployments, network } from "hardhat";
import fs from "fs";
import path from "path";
import { GasXConfig } from "../typechain-types";

/**
 * @notice A script to bulk-update the max USD limits per selector on the GasXConfig contract.
 * @dev Reads data from `packages/hardhat/data/selectors.json`.
 * Includes a "dry-run" mode to check for changes before sending a transaction.
 * To execute a dry run: yarn hardhat run scripts/loadAndSetMaxUsd.ts --network <your_network> --dry-run
 */
async function main() {
  // --- 1. Environment Setup ---
  const [signer] = await ethers.getSigners();
  const networkName = network.name;
  const isDryRun = process.argv.includes("--dry-run");

  console.log(`\n📡 Network: ${networkName}`);
  console.log(`🔑 Signer:  ${signer.address}`);
  if (isDryRun) {
    console.log("💨 DRY RUN MODE: No transaction will be sent.");
  }

  // --- 2. Load Contracts and Data ---
  const configDeployment = await deployments.get("GasXConfig");
  const config = (await ethers.getContractAt("GasXConfig", configDeployment.address)) as GasXConfig;
  console.log(`🎯 Config Contract: ${await config.getAddress()}`);

  // === Carga JSON de selectors
  const filePath = path.join(__dirname, "../data/selectors.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`❌ Data file not found at: ${filePath}`);
  }
  const rawData = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(rawData) as Record<string, string>;

  // --- 3. Process and Validate Data ---
  const selectorsToUpdate: `0x${string}`[] = [];
  const amountsToUpdate: bigint[] = [];

  const allCurrentLimits = await config.getAllLimits(Object.keys(data));

  for (const [i, [selector, usdStr]] of Object.entries(data).entries()) {
    if (!/^0x[a-fA-F0-9]{8}$/.test(selector)) {
      throw new Error(`❌ Invalid selector format in JSON: ${selector}`);
    }
    const newAmount = ethers.parseUnits(usdStr, 6);
    const currentAmount = allCurrentLimits[i];

    // ✅ KEY IMPROVEMENT: Only add to the update list if the value has actually changed.
    if (newAmount !== currentAmount) {
      selectorsToUpdate.push(selector as `0x${string}`);
      amountsToUpdate.push(newAmount);
    }
  }

  // --- 4. Execute Transaction (or report changes) ---
  if (selectorsToUpdate.length === 0) {
    console.log("\n✅ No changes detected. On-chain configuration is already up-to-date.");
    return;
  }

  console.log("\n📝 The following changes will be submitted:");
  selectorsToUpdate.forEach((s, i) => {
    console.log(`  • ${s} => $${ethers.formatUnits(amountsToUpdate[i], 6)}`);
  });

  if (isDryRun) {
    console.log("\n💨 Dry run complete. Exiting without sending transaction.");
    return;
  }

  console.log("\n⏳ Submitting transaction to update configuration...");
  const tx = await config.bulkSetMaxUsd(selectorsToUpdate, amountsToUpdate);
  await tx.wait();
  console.log(`✅ Config updated successfully! Tx Hash: ${tx.hash}`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
