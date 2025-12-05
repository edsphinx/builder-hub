import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { verifyContract } from "../helpers/verify";
import { getEnvironmentName, resolveEnvironment } from "../helpers/environment";
import { networkConfigs } from "../config/networks";
import { entryPoint08Address } from "viem/account-abstraction";

/**
 * @notice Deploys the GasXERC20FeePaymaster contract.
 * @dev This paymaster enables users to pay gas fees in ERC20 tokens (e.g., USDC)
 * instead of the native gas token. It uses off-chain price signatures verified
 * against an on-chain oracle for security.
 *
 * Required configuration in networkConfigs:
 * - feeToken: Address of the ERC20 token for fee payment (e.g., USDC)
 * - priceQuoteBaseToken: Address of the base token for price quotes (e.g., WETH)
 * - oracleSigner: Address authorized to sign price data
 * - minFee: Minimum fee in fee token units (optional, default 0)
 * - feeMarkupBps: Fee markup in basis points (optional, default 100 = 1%)
 *
 * @param hre The Hardhat Runtime Environment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log, get, getOrNull } = deployments;
  const { deployer } = await getNamedAccounts();

  const artifactName = "GasXERC20FeePaymaster";
  const forceRedeploy = process.env.REDEPLOY_ALL === "true" || process.env.REDEPLOY_ERC20_PAYMASTER === "true";

  // --- Environment Sanity Check Log ---
  const envName = getEnvironmentName(resolveEnvironment(network.name));
  const chainId = network.config.chainId?.toString() ?? (await hre.getChainId());
  log(`\n[DEPLOY] ${artifactName}`);
  log(`----------------------------------------------------`);
  log(`Environment: ${envName}`);
  log(`Network:     ${network.name} (Chain ID: ${chainId})`);
  log(`Deployer:    ${deployer}`);
  log(`----------------------------------------------------`);

  // --- Configuration & Validation ---
  const cfg = networkConfigs[chainId];
  if (!cfg) {
    throw new Error(`[ERROR] Configuration not found for chainId ${chainId} in config/networks.ts`);
  }

  const isLocalNetwork = network.name === "hardhat" || network.name === "localhost";

  // Get required addresses
  const entryPointAddress = isLocalNetwork ? (await get("EntryPoint")).address : entryPoint08Address;

  // Get MultiOracleAggregator address
  const oracleDeployment = await getOrNull("MultiOracleAggregatorProxy");
  if (!oracleDeployment) {
    log(`[WARN] MultiOracleAggregatorProxy not found. Skipping ${artifactName} deployment.`);
    log(`       Deploy the oracle first with: yarn deploy --tags MultiOracleAggregatorProxy`);
    return;
  }
  const oracleAddress = oracleDeployment.address;

  // ERC20 Fee Paymaster specific config
  const feeToken = cfg.feeToken || process.env.FEE_TOKEN_ADDRESS;
  const priceQuoteBaseToken = cfg.priceQuoteBaseToken || process.env.PRICE_QUOTE_BASE_TOKEN;
  const configuredOracleSigner = cfg.oracleSigner || process.env.ORACLE_SIGNER;
  const minFee = cfg.minFee || process.env.MIN_FEE || "0";
  const feeMarkupBps = cfg.feeMarkupBps || process.env.FEE_MARKUP_BPS || "100"; // Default 1%

  // Validate required addresses
  if (!feeToken || !ethers.isAddress(feeToken)) {
    log(`[WARN] feeToken not configured for network ${network.name}. Skipping ${artifactName} deployment.`);
    log(`       Set FEE_TOKEN_ADDRESS in .env or add feeToken to networkConfigs.`);
    return;
  }

  if (!priceQuoteBaseToken || !ethers.isAddress(priceQuoteBaseToken)) {
    log(`[WARN] priceQuoteBaseToken not configured for network ${network.name}. Skipping ${artifactName} deployment.`);
    log(`       Set PRICE_QUOTE_BASE_TOKEN in .env or add priceQuoteBaseToken to networkConfigs.`);
    return;
  }

  // Validate oracle signer - CRITICAL SECURITY CHECK
  let oracleSigner: string;
  if (!configuredOracleSigner || !ethers.isAddress(configuredOracleSigner)) {
    if (!isLocalNetwork) {
      log(`\n[SECURITY WARNING] Oracle signer not configured for production network ${network.name}!`);
      log(`                   Using deployer as oracle signer is NOT recommended for production.`);
      log(`                   Set ORACLE_SIGNER in .env or add oracleSigner to networkConfigs.`);
      log(`                   Proceeding with deployer address for testing purposes only...\n`);
    }
    oracleSigner = deployer;
  } else {
    oracleSigner = configuredOracleSigner;
  }

  log("\n  > Verifying contract arguments...");
  log(`    [OK] EntryPoint:          ${entryPointAddress}`);
  log(`    [OK] Fee Token:           ${feeToken}`);
  log(`    [OK] Price Quote Base:    ${priceQuoteBaseToken}`);
  log(`    [OK] Price Oracle:        ${oracleAddress}`);
  log(
    `    ${oracleSigner === deployer ? "[WARN]" : "[OK]"} Oracle Signer:       ${oracleSigner}${oracleSigner === deployer ? " (deployer - not recommended for production)" : ""}`,
  );
  log(`    [OK] Min Fee:             ${minFee}`);
  log(`    [OK] Fee Markup (bps):    ${feeMarkupBps}`);

  // --- Deployment ---
  if (!forceRedeploy) {
    const existing = await deployments.getOrNull(artifactName);
    if (existing) {
      log(`[WARN] ${artifactName} already deployed at ${existing.address}.`);
      log(`[INFO] To force redeploy, set REDEPLOY_ERC20_PAYMASTER=true.`);
      return;
    }
  }

  const deployResult = await deploy(artifactName, {
    from: deployer,
    args: [entryPointAddress, feeToken, priceQuoteBaseToken, oracleAddress, oracleSigner, minFee, feeMarkupBps],
    log: true,
  });

  log(`[OK] ${artifactName} deployed at: ${deployResult.address}`);

  // --- Optional Funding ---
  const shouldFund = process.env.FUND_ON_DEPLOY === "true";
  if (shouldFund) {
    if (cfg.stakeEth && cfg.depositEth) {
      log(`\n[FUND] Funding Paymaster (requested via FUND_ON_DEPLOY=true)...`);
      const paymaster = await hre.ethers.getContractAt(artifactName, deployResult.address);
      const UNSTAKE_DELAY_SEC = 86400; // 24 hours

      log(`  > Staking ${cfg.stakeEth} ETH...`);
      await (await paymaster.addStake(UNSTAKE_DELAY_SEC, { value: ethers.parseEther(cfg.stakeEth) })).wait();
      log(`    [OK] Stake completed.`);

      log(`  > Depositing ${cfg.depositEth} ETH...`);
      await (await paymaster.deposit({ value: ethers.parseEther(cfg.depositEth) })).wait();
      log(`    [OK] Deposit completed.`);
    } else {
      log(`\n[WARN] FUND_ON_DEPLOY=true, but 'stakeEth' or 'depositEth' are not defined in the config.`);
    }
  } else {
    log(`\n[INFO] Funding skipped. To fund on deploy, set FUND_ON_DEPLOY=true in your .env file.`);
  }

  // --- Verification ---
  await verifyContract(hre, artifactName, deployResult.address, deployResult.args || []);
  log(`----------------------------------------------------\n`);
};

export default func;
func.tags = ["GasXERC20FeePaymaster", "ERC20Paymaster"];
func.dependencies = ["MultiOracleAggregatorProxy"];
func.skip = async (hre: HardhatRuntimeEnvironment) => {
  func.dependencies = func.dependencies ?? [];
  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    func.dependencies.push("EntryPoint");
  }
  return false;
};
