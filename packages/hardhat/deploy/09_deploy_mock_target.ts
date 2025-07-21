import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * @notice Deploys the MockTarget contract for testing purposes.
 * @dev This script is designed to be skipped on public networks by default.
 * To override this and deploy to a public network, set the `DEPLOY_MOCKS` environment variable to `true`.
 * This is necessary for running E2E tests against deployed contracts on testnets.
 * @param hre The Hardhat Runtime Environment.
 *
 * @example
 * // Command to be executed from the monorepo root:
 * DEPLOY_MOCKS=true yarn deploy --network scrollSepolia --tags MockTarget
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("\nDeploying MockTarget contract...");

  const res = await deploy("MockTarget", {
    from: deployer,
    args: [],
    log: true,
    contract: "contracts/mocks/MockTarget.sol:MockTarget",
  });

  log(`✅ MockTarget deployed @ ${res.address}`);
};

func.skip = async hre => {
  const { network } = hre;
  // Skip on non-local networks unless DEPLOY_MOCKS is explicitly set to true
  if (network.name !== "localhost" && network.name !== "hardhat") {
    if (process.env.DEPLOY_MOCKS !== "true") {
      console.log(`Skipping MockTarget deployment on ${network.name}. Set DEPLOY_MOCKS=true to deploy.`);
      return true;
    }
  }
  return false; // Never skip on local networks or if DEPLOY_MOCKS is true
};
export default func;
func.tags = ["MockTarget"];
