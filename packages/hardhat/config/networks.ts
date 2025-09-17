// =================================================================================================
// CONFIGURATION
// This section defines the network-specific parameters for the GasXConfig contract.
// =================================================================================================

export interface NetworkConfig {
  oracleSigner?: string;
  entryPoint?: string;
  treasury?: string;
  stakeEth?: string;
  depositEth?: string;
  blockExplorerUrl?: string;
}

export const networkConfigs: Record<string, NetworkConfig> = {
  // --- LOCAL / DEVELOPMENT ---
  "31337": {
    // hardhat
    oracleSigner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    stakeEth: "0.01",
    depositEth: "0.05",
    // Treasury defaults to deployer on local network
  },
  // --- TESTNETS ---
  "11155111": {
    // sepolia
    oracleSigner: process.env.SEPOLIA_ORACLE_SIGNER ?? "",
    treasury: process.env.SEPOLIA_PAYMASTER_TREASURY ?? "",
  },
  "421614": {
    // arbitrumSepolia
    oracleSigner: process.env.ARBITRUM_SEPOLIA_ORACLE_SIGNER ?? "",
    treasury: process.env.ARBITRUM_SEPOLIA_PAYMASTER_TREASURY ?? "",
    blockExplorerUrl: "https://sepolia.arbiscan.io",
  },
  "84532": {
    // baseSepolia
    oracleSigner: process.env.BASE_SEPOLIA_ORACLE_SIGNER ?? "",
    treasury: process.env.BASE_SEPOLIA_PAYMASTER_TREASURY ?? "",
    blockExplorerUrl: "https://sepolia.basescan.org",
  },
  "534351": {
    // scrollSepolia
    oracleSigner: process.env.SCROLL_SEPOLIA_ORACLE_SIGNER ?? "",
    treasury: process.env.SCROLL_SEPOLIA_PAYMASTER_TREASURY ?? "",
    blockExplorerUrl: "https://sepolia.scrollscan.com",
  },
  // --- MAINNETS ---
  "1": {
    // ethereum
    oracleSigner: process.env.MAINNET_ORACLE_SIGNER ?? "",
    treasury: process.env.MAINNET_PAYMASTER_TREASURY ?? "",
    blockExplorerUrl: "https://etherscan.io",
  },
  // Add configurations for all other networks here
};
