import "dotenv/config";
import { ethers } from "hardhat";
import { deployments } from "hardhat";
import { expect } from "chai";
import { createSmartAccountClient, ENTRYPOINT_ADDRESS_V07 } from "permissionless";
import { signerToSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoPaymasterClient } from "permissionless/clients/pimlico";
import { http } from "viem";
import { scrollSepolia } from "viem/chains";
import { WalletFuel, MockTarget } from "../typechain-types";
import { EthersProviderAdapter } from "@alchemy/aa-ethers";

describe("Sponsorship Flow", function () {
  this.timeout(120000); // Increase timeout for the test

  let walletFuel: WalletFuel;
  let mockTarget: MockTarget;
  let smartAccountClient: any; // Use `any` to avoid type issues with the extended client

  before(async function () {
    // --- 1. Deploy contracts using fixture ---
    await deployments.fixture(["WalletFuel", "SimpleAccountFactory", "MockTarget"]);
    const walletFuelDeployment = await deployments.get("WalletFuel");
    const mockTargetDeployment = await deployments.get("MockTarget");

    walletFuel = await ethers.getContractAt("WalletFuel", walletFuelDeployment.address);
    mockTarget = await ethers.getContractAt("MockTarget", mockTargetDeployment.address);

    // --- 2. Configure Paymaster (WalletFuel) ---
    console.log("⛽️ Configuring WalletFuel Paymaster...");
    const selector = mockTarget.interface.getFunction("execute")!.selector;
    await (await walletFuel.setSelector(selector, true)).wait();
    console.log(`✅ Selector ${selector} whitelisted.`);
    await (await walletFuel.setLimit(200000, 1000000)).wait();
    console.log("✅ Gas limits set.");

    // --- 3. Initialize Bundler and Smart Account Clients ---
    const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
    const { deployer } = await ethers.getNamedSigners();
    const provider = ethers.provider;

    const paymasterClient = createPimlicoPaymasterClient({
      transport: http(`https://api.pimlico.io/v2/scroll-sepolia-testnet/rpc?apikey=${PIMLICO_API_KEY}`),
      entryPoint: ENTRYPOINT_ADDRESS_V07,
    });

    const smartAccount = await signerToSimpleSmartAccount(new EthersProviderAdapter(provider).toViem(), {
      signer: (await provider.getSigner(deployer.address)) as any,
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      factoryAddress: (await deployments.get("SimpleAccountFactory")).address as `0x${string}`,
    });

    smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      chain: scrollSepolia,
      transport: http(`https://api.pimlico.io/v2/scroll-sepolia-testnet/rpc?apikey=${PIMLICO_API_KEY}`),
      sponsorUserOperation: paymasterClient.sponsorUserOperation,
    });
  });

  it("Should sponsor a UserOperation", async function () {
    // --- 4. Send sponsored UserOperation ---
    console.log("🚀 Sending sponsored UserOperation...");
    const selector = mockTarget.interface.getFunction("execute")!.selector;
    const { hash } = await smartAccountClient.sendTransaction({
      to: (await mockTarget.getAddress()) as `0x${string}`,
      data: selector,
    });
    console.log("➡ UserOp Hash:", hash);
    const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash });
    console.log("✅ Receipt:", receipt);

    expect(receipt.success).to.equal(true);
  });
});
