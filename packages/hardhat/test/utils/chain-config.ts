import * as chains from "viem/chains";

/**
 * A mapping of network names (as used in hardhat.config.ts) to viem chain objects.
 * This allows us to dynamically select the correct chain configuration at runtime.
 */
const chainMap: Record<string, chains.Chain> = {
  scrollSepolia: chains.scrollSepolia,
  arbitrumSepolia: chains.arbitrumSepolia,
  // Add other supported networks here in the future
};

/**
 * Returns the viem Chain object corresponding to the network name.
 * @param networkName - The name of the network from `hre.network.name`.
 * @returns The viem Chain object or undefined if not found.
 */
export function getChain(networkName: string): chains.Chain | undefined {
  return chainMap[networkName];
}
