export enum Environment {
  Dev = 0,
  Testnet = 1,
  Production = 2,
}

export function resolveEnvironment(networkName: string): Environment {
  if (networkName === "hardhat" || networkName === "localhost") return Environment.Dev;

  if (
    ["sepolia", "base-sepolia", "scroll-sepolia", "scrollSepolia", "zksync-testnet", "arbitrum-sepolia"].includes(
      networkName,
    )
  )
    return Environment.Testnet;

  return Environment.Production;
}

export function getEnvironmentName(env: Environment): string {
  return Environment[env];
}
