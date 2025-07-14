import "dotenv/config";
import fs from "fs";
import path from "path";
import { createBundlerClient, createSmartAccountClient, toSmartContractAccount } from "@aa-sdk/core";
import { http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ethers } from "ethers";
import { WalletFuel__factory } from "../typechain-types";

// --- Helper function to load contract addresses ---
function load(name: string) {
  const p = path.resolve(__dirname, `../deployments/baseSepolia/${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`${name} not deployed`);
  return JSON.parse(fs.readFileSync(p, "utf8")).address as `0x${string}`;
}

async function main() {
  // --- 1. Load contract addresses and configuration ---
  const [walletFuelAddr, factoryAddr, targetAddr] = ["WalletFuel", "SimpleAccountFactory", "MockTarget"].map(load);
  const ENTRYPOINT_ADDRESS = process.env.ENTRYPOINT_ADDRESS! as `0x${string}`;
  const RPC_URL = process.env.RPC_URL!;
  const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
  const PRIVATE_KEY = process.env.PRIVATE_KEY! as `0x${string}`;

  const owner = privateKeyToAccount(PRIVATE_KEY);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const walletFuel = WalletFuel__factory.connect(walletFuelAddr, new ethers.Wallet(PRIVATE_KEY, provider));

  // --- 2. Configure Paymaster (WalletFuel) ---
  console.log("⛽️ Configuring WalletFuel Paymaster...");

  // --- Set selector ---
  const targetInterface = new ethers.Interface(["function execute()"]);
  const selector = targetInterface.getFunction("execute")!.selector;
  await (await walletFuel.setSelector(selector, true)).wait();
  console.log(`✅ Selector ${selector} whitelisted.`);

  // --- Set gas limits ---
  await (await walletFuel.setLimit(200000, 1000000)).wait();
  console.log(`✅ Gas limits set.`);

  // --- 3. Initialize Bundler and Smart Account Clients ---
  const bundler = createBundlerClient({
    chain: baseSepolia,
    transport: http(`https://api.pimlico.io/v2/scroll-sepolia-testnet/rpc?apikey=${PIMLICO_API_KEY}`),
  });

  const factoryAbi = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../deployments/baseSepolia/SimpleAccountFactory.json`), "utf8"),
  ).abi;
  const factory = new ethers.Contract(factoryAddr, factoryAbi, provider);
  const salt = 0;

  const createCalldata = factory.interface.encodeFunctionData("createAccount", [owner.address, salt]) as `0x${string}`;
  const initCode = ethers.concat([factoryAddr, createCalldata]) as `0x${string}`;

  const account = await toSmartContractAccount({
    source: "GasXMVP",
    transport: http(RPC_URL),
    chain: baseSepolia,
    entryPoint: { address: ENTRYPOINT_ADDRESS, version: "0.6.0" },
    getAccountInitCode: async () => initCode,
    getDummySignature: () => "0x",
    encodeExecute: async uo => uo.data!,
    signMessage: ({ message }) => owner.signMessage({ message }),
    signTypedData: td => owner.signTypedData(td),
  });

  const smartAccClient = createSmartAccountClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
    account,
    bundler: bundler,
    entryPoint: { address: ENTRYPOINT_ADDRESS, version: "0.6.0" },
    paymaster: {
      type: "custom",
      rpcUrl: "",
      getPaymasterAndData: async () => {
        return {
          paymasterAndData: walletFuelAddr,
        };
      },
    },
  });

  // --- 4. Send sponsored UserOperation ---
  console.log("🚀 Sending sponsored UserOperation...");
  const hash = await smartAccClient.sendUserOperation({ target: targetAddr, data: selector });
  console.log("➡ UserOp Hash:", hash);
  const receipt = await smartAccClient.waitForUserOperationReceipt({ hash });
  console.log("✅ Receipt:", receipt);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
