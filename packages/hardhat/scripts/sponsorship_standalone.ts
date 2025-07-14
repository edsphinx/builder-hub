import "dotenv/config";
import { ethers } from "ethers";
import { ENTRYPOINT_ADDRESS_V06, createSmartAccountClient } from "permissionless";
import { signerToSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoPaymasterClient } from "permissionless/clients/pimlico";
import { http, publicActions } from "viem";
import { scrollSepolia } from "viem/chains";
import { EthersProviderAdapter } from "@alchemy/aa-ethers";

// Adjust the import paths to be correct relative to the script location
import * as WalletFuelJson from "../artifacts/contracts/WalletFuel.sol/WalletFuel.json";
import * as MockTargetJson from "../artifacts/contracts/mocks/MockTarget.sol/MockTarget.json";
import walletFuelDeployment from "../deployments/scrollSepolia/WalletFuel.json";
import mockTargetDeployment from "../deployments/scrollSepolia/MockTarget.json";
import simpleAccountFactoryDeployment from "../deployments/scrollSepolia/SimpleAccountFactory.json";

async function main() {
  const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
  if (!PIMLICO_API_KEY) {
    throw new Error("PIMLICO_API_KEY is not set in .env");
  }

  const provider = new ethers.JsonRpcProvider(scrollSepolia.rpcUrls.default.http[0]);
  const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);

  console.log("🔩 Loading deployed contracts...");
  const walletFuel = new ethers.Contract(walletFuelDeployment.address, WalletFuelJson.abi, signer);
  const mockTarget = new ethers.Contract(mockTargetDeployment.address, MockTargetJson.abi, signer);

  console.log("⛽️ Configuring WalletFuel Paymaster...");
  const selector = mockTarget.interface.getFunction("execute").selector;
  await (await walletFuel.setSelector(selector, true)).wait();
  console.log(`✅ Selector ${selector} whitelisted.`);
  await (await walletFuel.setLimit(200000, 1000000)).wait();
  console.log("✅ Gas limits set.");

  console.log("🤖 Initializing Smart Account Client...");
  const paymasterClient = createPimlicoPaymasterClient({
    transport: http(`https://api.pimlico.io/v2/scroll-sepolia-testnet/rpc?apikey=${PIMLICO_API_KEY}`),
    entryPoint: ENTRYPOINT_ADDRESS_V06,
  });

  const viemProvider = new EthersProviderAdapter(provider).toViem();

  const smartAccount = await signerToSimpleSmartAccount(viemProvider as any, {
    signer: signer as any,
    entryPoint: ENTRYPOINT_ADDRESS_V06,
    factoryAddress: simpleAccountFactoryDeployment.address as `0x${string}`,
  });

  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain: scrollSepolia,
    transport: http(`https://api.pimlico.io/v2/scroll-sepolia-testnet/rpc?apikey=${PIMLICO_API_KEY}`),
    sponsorUserOperation: paymasterClient.sponsorUserOperation,
  }).extend(publicActions);

  console.log("🚀 Sending sponsored UserOperation...");
  const txData = mockTarget.interface.encodeFunctionData("execute");
  const { hash } = await smartAccountClient.sendTransaction({
    to: mockTarget.address as `0x${string}`,
    data: txData as `0x${string}`,
  });

  console.log("➡ UserOp Hash:", hash);
  const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash });
  console.log("✅ Receipt:", receipt);

  if (receipt.success) {
    console.log("🎉 Sponsorship test successful!");
  } else {
    console.error("🔥 Sponsorship test failed!");
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
