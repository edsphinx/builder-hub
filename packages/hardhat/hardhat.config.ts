import * as dotenv from "dotenv";
dotenv.config();
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomicfoundation/hardhat-verify";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "@openzeppelin/hardhat-upgrades";
import { task } from "hardhat/config";
import generateTsAbis from "./scripts/generateTsAbis";
import "./tasks/showAddress";
import { Wallet } from "ethers";

// If not set, it uses ours Alchemy's default API key.
// You can get your own at https://dashboard.alchemyapi.io
const providerApiKey = process.env.ALCHEMY_API_KEY || "oKxs-03sij-U_N0iOlrSsZFr29-IqbuF";
// If not set, it uses the hardhat account 0 private key.
// You can generate a random account with `yarn generate` or `yarn account:import` to import your existing PK

// ================================= KEY MANAGEMENT LOGIC =================================
// Define the default Hardhat private key as a safe fallback for local development.
const hardhatDefaultPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Function to safely get the deployer's private key.
const getDeployerPrivateKey = (): string => {
  // 1. Priority: Encrypted key (for testnets and mainnet)
  if (process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED && process.env.DEPLOYER_PASSWORD) {
    try {
      const wallet = Wallet.fromEncryptedJsonSync(
        process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED,
        process.env.DEPLOYER_PASSWORD,
      );
      console.log("✅ Deployer key successfully decrypted from .env.");
      return wallet.privateKey;
    } catch (error) {
      console.error("❌ Could not decrypt key. Check your .env and password.", error);
      // If decryption fails, it's a critical error. Stop the process.
      process.exit(1);
    }
  }

  // 2. Second priority: Direct private key (useful for CI/CD or simple setups)
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    console.log("✅ Using DEPLOYER_PRIVATE_KEY from .env.");
    return process.env.DEPLOYER_PRIVATE_KEY;
  }

  // 3. Fallback: Default Hardhat key (ONLY for local development)
  console.warn("⚠️  Deployer key not found in .env. Using default Hardhat account for local development.");
  return hardhatDefaultPrivateKey;
};

const deployerPrivateKey = getDeployerPrivateKey();
// ================================= END OF KEY MANAGEMENT LOGIC =================================

// If not set, it uses our block explorers default API keys.
const etherscanApiKey = process.env.ETHERSCAN_MAINNET_API_KEY || "DNXJA8RX2Q3VZ4URQIWP7Z68CJXQZSC6AW";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
        },
      },
      {
        version: "0.8.24",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
          // remappings: ["@account-abstraction/contracts/=./contracts/@account-abstraction/contracts/"],
        },
      },
      {
        version: "0.8.28",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
        },
      },
      {
        version: "0.8.29",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: {
      // By default, it will take the first Hardhat account as the deployer
      default: 0,
    },
  },
  networks: {
    // View the networks that are pre-configured.
    // If the network you are looking for is not here you can add new network settings
    hardhat: {
      hardfork: "cancun", // <─ VM local ejecuta Cancún
      chainId: 31337,
      /** ── opcional: fork de mainnet ── */
      forking:
        process.env.MAINNET_FORKING_ENABLED === "true"
          ? {
              url: `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`,
              blockNumber: undefined, // o fija uno concreto si lo deseas
            }
          : undefined,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    arbitrumSepolia: {
      url: `https://arb-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    optimism: {
      url: `https://opt-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    optimismSepolia: {
      url: `https://opt-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    polygonAmoy: {
      url: `https://polygon-amoy.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    polygonZkEvm: {
      url: `https://polygonzkevm-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    polygonZkEvmCardona: {
      url: `https://polygonzkevm-cardona.g.alchemy.com/v2/${providerApiKey}`,
      accounts: [deployerPrivateKey],
    },
    gnosis: {
      url: "https://rpc.gnosischain.com",
      accounts: [deployerPrivateKey],
    },
    chiado: {
      url: "https://rpc.chiadochain.net",
      accounts: [deployerPrivateKey],
    },
    base: {
      url: "https://mainnet.base.org",
      accounts: [deployerPrivateKey],
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: [deployerPrivateKey],
    },
    scrollSepolia: {
      url: "https://sepolia-rpc.scroll.io",
      accounts: [deployerPrivateKey],
    },
    scroll: {
      url: "https://rpc.scroll.io",
      accounts: [deployerPrivateKey],
    },
    celo: {
      url: "https://forno.celo.org",
      accounts: [deployerPrivateKey],
    },
    celoAlfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: [deployerPrivateKey],
    },
  },
  // Configuration for harhdat-verify plugin
  etherscan: {
    apiKey: `${etherscanApiKey}`,
    customChains: [
      {
        network: "scrollSepolia",
        chainId: 534351,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sepolia.scrollscan.com/",
        },
      },
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6", // explícito por claridad
    alwaysGenerateOverloads: false,
  },
};

// Extend the deploy task
task("deploy").setAction(async (args, hre, runSuper) => {
  // Run the original deploy task
  await runSuper(args);
  // Force run the generateTsAbis script
  await generateTsAbis(hre);
});

export default config;
