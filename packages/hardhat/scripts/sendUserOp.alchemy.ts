import "dotenv/config";
import fs from "fs";
import path from "path";
import { createBundlerClient, createSmartAccountClient, toSmartContractAccount, getEntryPoint } from "@aa-sdk/core";
import { http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ethers } from "ethers";

function load(name: string) {
  const p = path.resolve(__dirname, `../deployments/baseSepolia/${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`${name} no deployed`);
  return JSON.parse(fs.readFileSync(p, "utf8")).address as `0x${string}`;
}

async function main() {
  const [factoryAddr, target] = ["SimpleAccountFactory", "MockTarget"].map(load);
  const ENTRY = getEntryPoint(baseSepolia, { addressOverride: process.env.ENTRYPOINT_ADDRESS! as `0x${string}` });
  const RPC = process.env.RPC_URL!;
  const PIN = process.env.PIMLICO_API_KEY!;
  const owner = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`);

  const bundler = createBundlerClient({
    chain: baseSepolia,
    transport: http(`https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${PIN}`),
  });

  const provider = new ethers.JsonRpcProvider(RPC);
  const factoryAbi = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../deployments/baseSepolia/SimpleAccountFactory.json`), "utf8"),
  ).abi;
  const factory = new ethers.Contract(factoryAddr, factoryAbi, provider);
  const salt = 0;

  const createCalldata = factory.interface.encodeFunctionData("createAccount", [owner.address, salt]) as `0x${string}`;
  const initCode = ethers.concat([factoryAddr, createCalldata]) as `0x${string}`;

  const account = await toSmartContractAccount({
    source: "GasXMVP",
    transport: http(RPC),
    chain: baseSepolia,
    entryPoint: ENTRY,
    getAccountInitCode: async () => initCode,
    getDummySignature: () => "0x",
    encodeExecute: async uo => uo.data!,
    signMessage: ({ message }) => owner.signMessage({ message }),
    signTypedData: td => owner.signTypedData(td),
  });

  const smartAccClient = createSmartAccountClient({
    chain: baseSepolia,
    transport: http(RPC),
    account,
    bundler: bundler, // en la versión actual va como 'bundler', no bundlerTransport
    entryPoint: ENTRY,
    paymaster: {
      type: "custom",
      rpcUrl: "",
      getPaymasterAndData: async () => gasX,
    },
  });

  const hash = await smartAccClient.sendUserOperation({ target, data: "0x1249c58b" });
  console.log("➡ UserOp Hash:", hash);
  const receipt = await smartAccClient.waitForUserOperationReceipt({ hash });
  console.log("✅ Receipt:", receipt);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
