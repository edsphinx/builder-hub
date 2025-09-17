import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { verifyContract } from "../../helpers/verify";
import { getEnvironmentName, resolveEnvironment } from "../../helpers/environment";

/**
 * @notice Upgrades the MultiOracleAggregator UUPS proxy to a new implementation (V2).
 * @dev THIS IS AN OPERATIONAL SCRIPT. It is skipped by default.
 * To run this upgrade, you must explicitly set the `RUN_UPGRADE=true` environment variable.
 * It depends on the V1 proxy instance having been previously deployed.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { log } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxyDeploymentName = "MultiOracleAggregatorInstance";
  const artifactNameV2 = "MultiOracleAggregatorV2"; // The name of the new logic contract

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId ?? Number(await hre.ethers.provider.send("eth_chainId", []));
  log(`\n🛰️  Executing Operation: Upgrade ${proxyDeploymentName} to V2`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Signer:      ${deployer}`);
  log(`----------------------------------------------------`);

  // --- 1. Get the V1 Proxy Address ---
  log(`  > Step 1: Locating existing proxy deployment: ${proxyDeploymentName}...`);
  const existingProxyDeployment = await deployments.get(proxyDeploymentName);
  const V1_PROXY_ADDRESS = existingProxyDeployment.address;
  log(`    ✅ Found proxy at: ${V1_PROXY_ADDRESS}`);

  // --- 2. Prepare V2 Implementation ---
  log(`\n  > Step 2: Preparing V2 implementation contract: ${artifactNameV2}...`);
  const MultiOracleAggregatorV2Factory = await ethers.getContractFactory(artifactNameV2);
  log(`    ✅ V2 contract factory loaded.`);

  // --- 3. Perform the Proxy Upgrade ---
  log(`\n  > Step 3: Upgrading proxy at ${V1_PROXY_ADDRESS}...`);
  try {
    const upgradedAggregator = await upgrades.upgradeProxy(V1_PROXY_ADDRESS, MultiOracleAggregatorV2Factory, {
      kind: "uups",
      call: { fn: "initializeV2" },
      unsafeAllow: ["missing-initializer", "constructor"], // Specific to this V2 mock
    });

    await upgradedAggregator.waitForDeployment();
    const upgradedAddress = await upgradedAggregator.getAddress();
    const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(V1_PROXY_ADDRESS);

    log(`\n🎉 Upgrade successful!`);
    log(`   - Proxy Address (unchanged): ${upgradedAddress}`);
    log(`   - New V2 Implementation Address: ${newImplementationAddress}`);

    // --- 4. Verify New Implementation ---
    if (network.live) {
      log(`\n  > Step 4: Verifying new V2 implementation on block explorer...`);
      await verifyContract(hre, artifactNameV2, newImplementationAddress, []);
    } else {
      log(`\n  > Step 4: Skipping block explorer verification on local network.`);
    }

    log(`----------------------------------------------------\n`);
  } catch (error) {
    console.error("\n❌ FATAL: Upgrade process failed.");
    console.error(error);
    process.exit(1);
  }
};
// --- SAFETY MECHANISM ---
// This function prevents the script from running by default.
func.skip = async () => {
  if (process.env.RUN_UPGRADE !== "true") {
    console.log(`\n⏩ Skipping upgrade script. To run, set RUN_UPGRADE=true in your environment.`);
    return true; // Skips the script.
  }
  return false; // Proceeds with the script.
};
export default func;
func.tags = ["MultiOracleAggregatorV2Upgrade"];
func.dependencies = ["MultiOracleAggregatorInstance"];
