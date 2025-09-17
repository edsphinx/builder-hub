import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import fs from "fs";
import path from "path";
import { networkConfigs } from "../config/networks";

/**
 * @notice This script automatically generates a markdown file documenting the deployed contract addresses.
 * @dev It runs at the end of every deployment to a non-local network. It dynamically
 * generates the correct block explorer links based on the target network.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network, deployments } = hre;
  const { log } = deployments;

  // Do not generate history for local networks
  if (network.name === "hardhat" || network.name === "localhost") {
    return;
  }

  const chainId = network.config.chainId?.toString() ?? (await hre.getChainId());
  const explorerBaseUrl = networkConfigs[chainId]?.blockExplorerUrl;

  if (!explorerBaseUrl) {
    log(`⚠️  No blockExplorerUrl configured for network '${network.name}'. Skipping history generation.`);
    return;
  }

  log("\n📜 Generating deployment history...");

  try {
    const allDeployments = await deployments.all();
    const date = new Date().toISOString().slice(0, 10);
    const historyFilePath = path.join(__dirname, "..", "..", "..", "deployHistory.md");

    // --- Generate Markdown Content ---
    let markdown = `\n---\n\n## Deployment to \`${network.name}\` - ${date}\n\n`;
    markdown += `| Contract | Address | Explorer Link |\n`;
    markdown += `| :--- | :--- | :--- |\n`;

    for (const name in allDeployments) {
      if (Object.prototype.hasOwnProperty.call(allDeployments, name)) {
        const deployment = allDeployments[name];
        const explorerUrl = `${explorerBaseUrl}/address/${deployment.address}`;
        const explorerName = new URL(explorerBaseUrl).hostname;
        markdown += `| **${name}** | \`${deployment.address}\` | [View on ${explorerName}](${explorerUrl}) |\n`;
      }
    }

    // --- Prepend the new entry to the history file ---
    let existingHistory = "";
    if (fs.existsSync(historyFilePath)) {
      existingHistory = fs.readFileSync(historyFilePath, "utf8");
    } else {
      existingHistory =
        "# Deployment History\n\nThis document records the smart contract deployments made to different networks.";
    }

    // This logic correctly prepends the new deployment record to the top of the file.
    const headerEnd = existingHistory.indexOf("\n---");
    const header = headerEnd !== -1 ? existingHistory.substring(0, headerEnd) : existingHistory;
    const pastHistory = headerEnd !== -1 ? existingHistory.substring(headerEnd) : "";
    const finalHistory = `${header}${markdown}${pastHistory}`;

    fs.writeFileSync(historyFilePath, finalHistory);

    log(`✅ Deployment history updated successfully in ${path.basename(historyFilePath)}.`);
  } catch (error) {
    log(`❌ Error generating deployment history: ${error}`);
  }
};
export default func;
func.tags = ["GenerateHistory"];
func.runAtTheEnd = true; // Ensures it runs after all other deployments
