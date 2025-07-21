// This test is designed for public networks (e.g., Scroll Sepolia).
// It verifies the end-to-end sponsored UserOperation flow for the GasX contract in a public environment.

import "dotenv/config";
import { expect } from "chai";
import { deployments, network } from "hardhat";
import { createPublicClient, http, Address, encodeFunctionData, PublicClient, Hex } from "viem";
import { scrollSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient, SmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { Wallet } from "ethers";

type SimpleSmartAccount = Awaited<ReturnType<typeof toSimpleSmartAccount>>;

describe("GasX E2E Sponsorship Flow (Public)", function () {
  this.timeout(180000);

  let smartAccount: SimpleSmartAccount;
  let smartAccountClient: SmartAccountClient;
  let publicClient: PublicClient;
  let deployerAccount: ReturnType<typeof privateKeyToAccount>;
  let gasXAddress: Address;
  let gasXDeployment: any;
  let mockTargetDeployment: any;
  let mockTargetAddress: Address;

  before(async function () {
    if (network.name !== "scrollSepolia") {
      this.skip();
    }

    // 0.1: Variables de Entorno
    console.log("  > 0.1: Validando variables de entorno...");
    const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
    const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
    const password = process.env.DEPLOYER_PASSWORD;
    if (!PIMLICO_API_KEY || !encryptedKey || !password) {
      throw new Error("Required environment variables not found.");
    }
    console.log("    ✅ Variables de entorno cargadas.");

    console.log(`\n--- Test Setup Complete ---`);
    console.log(`  Running on public network: ${network.name}`);
    console.log(`---------------------------\n`);

    // Set up clients and accounts
    const decryptedWallet = await Wallet.fromEncryptedJson(encryptedKey, password);
    deployerAccount = privateKeyToAccount(decryptedWallet.privateKey as Hex);

    publicClient = createPublicClient({
      chain: scrollSepolia,
      transport: http(),
    });

    gasXDeployment = await deployments.get("GasX");
    mockTargetDeployment = await deployments.get("MockTarget");

    console.log("\n🛠️  Fase 1: Verificando y configurando el estado de los contratos...");
    gasXAddress = gasXDeployment.address as Address;
    mockTargetAddress = mockTargetDeployment.address as Address;

    const pimlicoUrl = `https://api.pimlico.io/v2/${scrollSepolia.id}/rpc?apikey=${PIMLICO_API_KEY}`;
    const paymasterClient = createPimlicoClient({ transport: http(pimlicoUrl) });

    expect(paymasterClient).to.be.an("object").with.property("sponsorUserOperation");
    console.log("  > Pimlico Paymaster Client created and verified successfully.");

    // Create a smart account using the simple, bundler-aware method.
    smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: deployerAccount,
    });

    smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      chain: scrollSepolia,
      bundlerTransport: http(pimlicoUrl),
      paymaster: paymasterClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await paymasterClient.getUserOperationGasPrice()).fast;
        },
      },
    });
  });

  before("Phase 1: State Verification & Configuration", async function () {
    console.log("\n🛠️  Fase 1: Verificando y configurando el estado de los contratos...");
    gasXAddress = gasXDeployment.address as Address;
    mockTargetAddress = mockTargetDeployment.address as Address;

    // 1.1: Verificación del Dueño del Paymaster
    console.log("  > 1.1: Verificando que el deployer es el dueño del Paymaster...");
    const owner = await publicClient.readContract({
      address: gasXAddress,
      abi: gasXDeployment.abi,
      functionName: "owner",
    });
    if ((owner as Address).toLowerCase() !== deployerAccount.address.toLowerCase()) {
      throw new Error(
        `❌ Error fatal: El deployer (${deployerAccount.address}) NO es el dueño del Paymaster. El dueño actual es ${owner}.`,
      );
    }
    console.log("    ✅ Verificación de dueño correcta.");
  });

  it("Should execute a sponsored UserOperation", async function () {
    this.timeout(60000);

    console.log("\n🚀 Executing sponsored UserOperation...");

    const callData = encodeFunctionData({ abi: mockTargetDeployment.abi, functionName: "execute", args: [] });

    try {
      // Volvemos a la llamada de alto nivel 'sendTransaction', que debería funcionar
      // ahora que el cliente y la cuenta están configurados correctamente.
      const userOpHash = await smartAccountClient.sendTransaction({
        account: smartAccountClient.account,
        chain: publicClient.chain,
        to: mockTargetAddress as Address,
        data: callData,
      });

      console.log(`  > UserOperation sent. Hash: ${userOpHash}`);
      console.log("  > Waiting for the transaction to be mined...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: userOpHash });

      expect(receipt.status).to.equal("success");
      console.log("  ✅ Transaction mined successfully! Status:", receipt.status);

      // Final verification with retries to handle node sync delays
      let counter: any;
      for (let i = 0; i < 5; i++) {
        try {
          console.log(`  > Attempting to read counter (Attempt ${i + 1}/5)...`);
          counter = await publicClient.readContract({
            address: mockTargetAddress as Address,
            abi: mockTargetDeployment.abi,
            functionName: "counter",
          });
          if (counter > 0n) {
            break; // Exit loop if counter is updated
          }
        } catch (e) {
          console.warn(`  > Read attempt ${i + 1} failed. Error: ${e}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay between retries
      }

      expect(counter).to.be.greaterThan(0n); // Check if it has been incremented
      console.log("  ✅ Verified MockTarget was called.");
      console.log("--- TEST END ---\n");
    } catch (error: any) {
      console.error("\n\n❌ ---- EXECUTION ERROR ---- ❌");
      console.error("  > Full Error:", error);
      if (error.cause?.meta?.details) {
        console.error("  > Bundler/Paymaster Details:", error.cause.meta.details);
      } else if (error.meta?.details) {
        console.error("  > Bundler/Paymaster Details:", error.meta.details);
      }
      console.error("------------------------------------\n\n");
      throw error;
    }
  });
});
