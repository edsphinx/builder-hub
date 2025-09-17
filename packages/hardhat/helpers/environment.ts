import * as chains from "viem/chains";

export enum Environment {
  Dev = 0,
  Testnet = 1,
  Production = 2,
}

/**
 * A dynamic list of all chain objects imported from viem.
 * This allows us to look up chain properties by their short name.
 */
const allChains: Record<string, chains.Chain> = chains;

// ✅ Explicit list of networks deployed to production.
const productionNetworks = ["mainnet", "arbitrum", "optimism", "base", "scroll", "linea"];

/**
 * Resolves the environment (Dev, Testnet, Production) for a given network name.
 * This function is now DYNAMIC and will work for any chain supported by viem/chains.
 * @param networkName - The name of the network from `hre.network.name`.
 * @returns The Environment enum value.
 */
export function resolveEnvironment(networkName: string): Environment {
  // 1. Dev environments are always local.
  if (networkName === "hardhat" || networkName === "localhost") {
    return Environment.Dev;
  }

  // 2. Explicitly check if the network is a known production mainnet.
  if (productionNetworks.includes(networkName)) {
    return Environment.Production;
  }

  // 3. Dynamically check if the network is a known testnet.
  const chain = allChains[networkName];
  if (chain?.testnet) {
    return Environment.Testnet;
  }

  // 4. If the network is unknown, throw an error to prevent misclassification.
  throw new Error(
    `Unknown network '${networkName}'. Please classify it as 'production' or ensure it exists in the 'viem/chains' library as a testnet.`,
  );
}

/**
 * Returns the string name for a given Environment enum value (e.g., "Testnet").
 * @param env - The Environment enum value.
 * @returns The string representation of the environment.
 */
export function getEnvironmentName(env: Environment): string {
  return Environment[env];
}
