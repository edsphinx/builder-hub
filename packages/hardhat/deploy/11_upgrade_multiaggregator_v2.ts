import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { verifyContract } from "../helpers/verify";

/**
 * @notice Upgrades the existing MultiOracleAggregator UUPS proxy to version V2.
 * @dev This script depends on the V1 implementation and V1 proxy having been deployed
 * by '02_deploy_multiaggregator.ts' and '03_deploy_multiaggregator_proxy.ts'.
 * @param hre Hardhat Runtime Environment injected by `hardhat-deploy`.
 * @returns Promise that resolves when the contract is upgraded.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { log } = deployments;
  const { deployer } = await getNamedAccounts();

  // This should match the name used to save the V1 proxy in 03_deploy_multiaggregator_proxy.ts
  const proxyName = "MultiOracleAggregatorInstance";
  const artifactNameV2 = "MultiOracleAggregatorV2"; // Name of the V2 contract artifact

  log(`\n--- Starting V2 Upgrade on network: ${network.name} ---`);
  log(`Deployer account: ${deployer}`);

  // --- 1. Get the V1 Proxy Address ---
  // Hardhat Deploy allows us to fetch the address of previously deployed contracts
  const existingProxyDeployment = await deployments.get(proxyName);
  const V1_PROXY_ADDRESS = existingProxyDeployment.address;

  if (!V1_PROXY_ADDRESS) {
    console.error(`Error: V1 proxy address for '${proxyName}' not found in deployments.`);
    console.error("Please ensure '03_deploy_multiaggregator_proxy.ts' has been executed first.");
    process.exit(1);
  }

  log(`V1 Proxy Address: ${V1_PROXY_ADDRESS}`);

  // --- 2. Get the V2 Contract Factory ---
  log(`Loading contract factory for ${artifactNameV2}...`);
  const MultiOracleAggregatorV2Factory = await ethers.getContractFactory(artifactNameV2);
  log(`Successfully loaded factory for ${artifactNameV2}.`);

  // --- 3. Perform the Proxy Upgrade ---
  log(`Upgrading proxy at ${V1_PROXY_ADDRESS} to ${artifactNameV2}...`);
  try {
    const upgradedAggregator = await upgrades.upgradeProxy(V1_PROXY_ADDRESS, MultiOracleAggregatorV2Factory, {
      kind: "uups", // Essential for UUPS proxy upgrades
      call: { fn: "initializeV2" }, // Calls your new V2 initializer function
      // These 'unsafeAllow' directives are necessary due to the specific structure
      // of the V2 contract (constructor, and parent initializers in reinitializer).
      unsafeAllow: ["missing-initializer", "constructor"],
    });

    // Wait for the transaction deploying the new V2 implementation to be mined
    await upgradedAggregator.waitForDeployment();

    const upgradedAddress = await upgradedAggregator.getAddress();
    const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(V1_PROXY_ADDRESS);

    log(`Proxy upgraded successfully! New implementation deployed.`);
    log(`New V2 Implementation Address: ${newImplementationAddress}`);
    log(`Proxy Contract Address (remains the same): ${upgradedAddress}`);

    // --- 4. Verify the New Implementation on Etherscan (ONLY for public networks) ---
    // 'network.live' is a Hardhat Deploy property that is true for public/live networks(just discovered this when working on this script)
    if (network.live) {
      log(`Initiating verification of ${artifactNameV2} on Etherscan...`);
      try {
        // ===================
        // Implementation contracts deployed via upgrades do not have constructor arguments
        await verifyContract(hre, artifactNameV2, newImplementationAddress, []);
        // ===================
        log("V2 Implementation verified successfully!");
      } catch (error: any) {
        if (error.message.includes("Reason: Already Verified")) {
          log("V2 implementation already verified, skipping verification.");
        } else {
          console.error("Error verifying V2 implementation:", error);
        }
      }
    } else {
      log("Skipping Etherscan verification on local network.");
    }

    log("\n--- V2 Upgrade Script Finished ---");
  } catch (error) {
    console.error("Error during V2 upgrade:", error);
    process.exit(1);
  }
};

export default func;
func.tags = ["MultiOracleAggregatorV2Upgrade"];
func.dependencies = ["MultiOracleAggregatorInstance"];
