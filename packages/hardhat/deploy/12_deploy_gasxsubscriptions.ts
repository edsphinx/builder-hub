import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { verifyContract } from "../helpers/verify";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";
import { networkConfigs, NetworkConfig } from "../config/networks";

/**
 * @notice Deploys the GasXSubscriptions contract as a UUPS proxy.
 * @dev This script deploys the subscription and credit management contract,
 * configuring it with the treasury and USDC addresses for the target network.
 * Uses UUPS proxy pattern for upgradeability.
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log, getOrNull } = deployments;
  const { deployer } = await getNamedAccounts();

  const artifactName = "GasXSubscriptions";
  const forceRedeploy = process.env.REDEPLOY_ALL === "true" || process.env.REDEPLOY_SUBSCRIPTIONS === "true";

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId?.toString() ?? (await hre.getChainId());
  log(`\n🛰️  Deploying: ${artifactName} (UUPS Proxy)`);
  log(`----------------------------------------------------`);
  log(`🌐 Environment: ${envName}`);
  log(`🔗 Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`👤 Deployer:    ${deployer}`);
  log(`----------------------------------------------------`);

  // --- Configuration & Validation ---
  const cfg: NetworkConfig | undefined = networkConfigs[chainId];
  if (!cfg) {
    throw new Error(`❌ Configuration not found for chainId ${chainId} in config/networks.ts`);
  }

  const isLocalNetwork = network.name === "hardhat" || network.name === "localhost";

  // Get treasury address (or use deployer as fallback)
  const treasuryAddress = cfg.treasury || deployer;

  // Get USDC address from config (use feeToken as it's already USDC)
  let usdcAddress = cfg.feeToken;

  // For local networks, deploy a mock USDC if needed
  if (isLocalNetwork || !usdcAddress) {
    const mockUsdc = await getOrNull("MockUSDC");
    if (mockUsdc) {
      usdcAddress = mockUsdc.address;
      log(`  > Using MockUSDC at ${usdcAddress}`);
    } else {
      // Deploy mock USDC for testing
      log(`  > Deploying MockUSDC for testing...`);
      const mockDeploy = await deploy("MockUSDC", {
        from: deployer,
        contract: "MockERC20",
        args: ["Mock USDC", "USDC", 6],
        log: true,
      });
      usdcAddress = mockDeploy.address;
    }
  }

  if (!usdcAddress || !ethers.isAddress(usdcAddress) || usdcAddress === ethers.ZeroAddress) {
    throw new Error(
      `❌ Invalid USDC address for network ${network.name}. Set feeToken in config/networks.ts or deploy MockUSDC.`,
    );
  }

  log("\n  > Verifying contract arguments...");
  log(`    ✅ Treasury: ${treasuryAddress}`);
  log(`    ✅ USDC:     ${usdcAddress}`);

  // --- Deployment (UUPS Proxy) ---
  if (!forceRedeploy) {
    const existing = await deployments.getOrNull(artifactName);
    if (existing) {
      log(`⚠️  ${artifactName} already deployed at ${existing.address}.`);
      log(`ℹ️  To force redeploy, set REDEPLOY_SUBSCRIPTIONS=true in your .env file.`);
      return;
    }
  }

  // Deploy using hardhat-deploy's proxy feature
  const deployResult = await deploy(artifactName, {
    from: deployer,
    proxy: {
      proxyContract: "ERC1967Proxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [treasuryAddress, usdcAddress],
        },
      },
    },
    log: true,
  });

  log(`✅ ${artifactName} proxy deployed at: ${deployResult.address}`);
  if (deployResult.implementation) {
    log(`   Implementation at: ${deployResult.implementation}`);
  }

  // --- Post-deployment: Add additional tokens if configured ---
  const shouldAddTokens = process.env.ADD_TOKENS_ON_DEPLOY === "true";
  if (shouldAddTokens) {
    log(`\n💰 Adding additional payment tokens...`);
    const subscriptions = await hre.ethers.getContractAt(artifactName, deployResult.address);

    // USDT addresses by chain
    const usdtAddresses: Record<string, string> = {
      "1": "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum
      "42161": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum
      "8453": "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // Base
      "534352": "0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df", // Scroll
    };

    // DAI addresses by chain
    const daiAddresses: Record<string, string> = {
      "1": "0x6B175474E89094C44Da98b954EedeeCB5BE1Bf14", // Ethereum
      "42161": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // Arbitrum
      "8453": "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // Base
      "534352": "0xcA77eB3fEFe3725Dc33bccB54eDEFc3D9f764f97", // Scroll
    };

    const usdt = usdtAddresses[chainId];
    const dai = daiAddresses[chainId];

    if (usdt) {
      try {
        await (await subscriptions.addSupportedToken(usdt, 6)).wait();
        log(`    ✅ Added USDT: ${usdt}`);
      } catch (e) {
        log(`    ⚠️  Failed to add USDT: ${e}`);
      }
    }

    if (dai) {
      try {
        await (await subscriptions.addSupportedToken(dai, 18)).wait();
        log(`    ✅ Added DAI: ${dai}`);
      } catch (e) {
        log(`    ⚠️  Failed to add DAI: ${e}`);
      }
    }
  } else {
    log(`\nℹ️  Additional tokens not added. To add USDT/DAI on deploy, set ADD_TOKENS_ON_DEPLOY=true`);
  }

  // --- Verification ---
  await verifyContract(hre, artifactName, deployResult.address, deployResult.args || []);
  log(`----------------------------------------------------\n`);
};

export default func;
func.tags = ["GasXSubscriptions"];
func.dependencies = [];
