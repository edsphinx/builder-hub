export const DEPLOYED_ADDRESSES = {
  WalletFuel: {
    "31337": "0x...", // Hardhat local
    "84532": "0x...", // Base Sepolia
    "421614": "0x...", // Arbitrum Sepolia
    "1": "0x...", // Mainnet
  },
  Config: {
    "31337": "0x...",
    "84532": "0x...",
    "421614": "0x...",
    "1": "0x...",
  },
} as const;

export const CHAIN_IDS = {
  HARDHAT: "31337",
  BASE_SEPOLIA: "84532",
  ARB_SEPOLIA: "421614",
  MAINNET: "1",
} as const;

export type ChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

export function getAddress(contract: keyof typeof DEPLOYED_ADDRESSES, chainId: number): string {
  const id = String(chainId) as ChainId;
  const addr = DEPLOYED_ADDRESSES[contract][id];
  if (!addr) throw new Error(`❌ Missing ${contract} address for chainId ${chainId}`);
  return addr;
}
