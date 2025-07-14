import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import fs from "fs";
import path from "path";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { network, deployments } = hre;
  const { log } = deployments;

  if (network.name === "hardhat" || network.name === "localhost") {
    return; // Do not generate history for local networks
  }

  log("\nGenerating deployment history...");

  try {
    const allDeployments = await deployments.all();
    const date = new Date().toISOString().slice(0, 10);
    const historyFilePath = path.join(__dirname, "..", "..", "..", "deployHistory.md");

    // --- Start Markdown Content ---
    // Use simple string concatenation to avoid linter parsing issues with nested backticks.
    let markdown = "\n---\n\n## Deployment to `" + network.name + "` - " + date + "\n\n";
    markdown += `| Contract | Address | Explorer Link |\n`;
    markdown += `| :--- | :--- | :--- |\n`;

    for (const name in allDeployments) {
      if (Object.prototype.hasOwnProperty.call(allDeployments, name)) {
        const deployment = allDeployments[name];
        const explorerUrl = `https://sepolia.scrollscan.com/address/${deployment.address}`;
        markdown += `| **${name}** | \`${deployment.address}\` | [View on Scrollscan](${explorerUrl}#code) |\n`;
      }
    }
    // --- End Markdown Content ---

    // Prepend the new entry to the history file
    let existingHistory = "";
    if (fs.existsSync(historyFilePath)) {
      existingHistory = fs.readFileSync(historyFilePath, "utf8");
    } else {
      existingHistory =
        "# Deployment History\n\nThis document records the smart contract deployments made to the different networks.";
    }

    const headerEnd = existingHistory.indexOf("\n---");
    let header =
      "# Deployment History\n\nThis document records the smart contract deployments made to the different networks.";
    let pastHistory = "";

    if (headerEnd !== -1) {
      header = existingHistory.substring(0, headerEnd);
      pastHistory = existingHistory.substring(headerEnd);
    }

    const finalHistory = `${header}${markdown}${pastHistory}`;

    fs.writeFileSync(historyFilePath, finalHistory);

    log(`✅ Deployment history updated in ${historyFilePath}`);
  } catch (error) {
    log(`❌ Error generating deployment history: ${error}`);
  }
};

export default func;
func.tags = ["GenerateHistory"];
func.runAtTheEnd = true; // Ensures it runs after all other deployments
