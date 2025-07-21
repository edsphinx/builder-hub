// This test is designed for public networks (e.g., Scroll Sepolia).
// It verifies the end-to-end sponsored UserOperation flow for the GasX contract in a public environment.

import "dotenv/config";
import { expect } from "chai";
import { deployments, network } from "hardhat";
import {
  createPublicClient,
  createWalletClient,
  http,
  Address,
  encodeFunctionData,
  toFunctionSelector,
  PublicClient,
  parseEther,
  formatEther,
} from "viem";
import { scrollSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { entryPoint08Address, entryPoint08Abi } from "viem/account-abstraction";
import { createSmartAccountClient, SmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { Wallet } from "ethers";

// --- 💡 DEPURATION MODE 💡 ---
// Set this on 'true' to disable sponsorship. Essential to isolate issues.
const DEBUG_MODE_NO_SPONSORSHIP = false;

type SimpleSmartAccount = Awaited<ReturnType<typeof toSimpleSmartAccount>>;

interface ContractToVerify {
  name: string;
  address: Address;
}

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

  before("Phase 0: Pre-flight System & Environment Checks", async function () {
    if (network.name !== "scrollSepolia") {
      this.skip();
    }

    // [0] ENVIRONMENT VALIDATION
    console.log("  > 0.1: Verifying environment variables...");
    const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
    const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
    const password = process.env.DEPLOYER_PASSWORD;
    if (!PIMLICO_API_KEY || !encryptedKey || !password) {
      throw new Error(
        "Required environment variables (PIMLICO_API_KEY, DEPLOYER_PRIVATE_KEY_ENCRYPTED, DEPLOYER_PASSWORD) not found.",
      );
    }
    console.log("    ✅ Environment variables loaded.");

    // 0.2: Conectividad RPC y Carga de Artefactos
    console.log("  > 0.2: Verifying conectivity to RPC & loading artifacts...");
    const networkName = network.name; // Standardized network access
    publicClient = createPublicClient({
      chain: scrollSepolia,
      transport: http(),
    });
    const chainId = await publicClient.getChainId();
    console.log(`    ✅ Conectivity to ${networkName} (Chain ID: ${chainId}) confirmed.`);

    gasXDeployment = await deployments.get("GasX");
    mockTargetDeployment = await deployments.get("MockTarget");
    console.log("    ✅ Contract deployments loaded.");

    // 0.3: Integridad de los Contratos Desplegados
    console.log("  > 0.3: Verifying contracts exists on public blockchain...");
    const contractsToVerify: ContractToVerify[] = [
      { name: "GasX (Paymaster)", address: gasXDeployment.address as Address },
      { name: "MockTarget", address: mockTargetDeployment.address as Address },
    ];
    for (const contract of contractsToVerify) {
      const bytecode = await publicClient.getCode({ address: contract.address });
      if (!bytecode || bytecode === "0x") {
        throw new Error(
          `❌ Fatal Error: Did not found bytecode on address of '${contract.name}' (${contract.address}). Asegúrate de que esté desplegado en ${networkName}.`,
        );
      }
    }
    console.log("    ✅ All contract addresses have deployed bytecode.");

    // 0.4: Desencriptación y Saldo del Deployer
    console.log("  > 0.4: Verifying deployer account & balance...");
    const decryptedWallet = await Wallet.fromEncryptedJson(encryptedKey, password);
    deployerAccount = privateKeyToAccount(decryptedWallet.privateKey as Address);

    const deployerBalance = await publicClient.getBalance({ address: deployerAccount.address });
    console.log(`    ✅ Deployer EOA: ${deployerAccount.address}`);
    console.log(`    ✅ Deployer Balance: ${formatEther(deployerBalance)} ETH.`);
    if (deployerBalance === 0n && DEBUG_MODE_NO_SPONSORSHIP) {
      console.warn(
        "    ⚠️  ADVERTENCIA: El modo de depuración está activo y la cuenta del deployer no tiene ETH para pagar el gas.",
      );
    }

    console.log("🎉 Fase 0 completed: All verifications passed.");

    console.log(`\n--- Test Setup Complete ---`);
    console.log(`  Running on public network: ${network.name}`);
    console.log(`---------------------------\n`);

    // [1] CLIENTS AND ACCOUNTS SETUP

    console.log("\n  > [1] Creating Public Client...");
    publicClient = createPublicClient({
      chain: scrollSepolia,
      transport: http(),
    });
    expect(publicClient).to.not.equal(undefined); // Verify publicClient is initialized
    console.log("    ✅ Public Client created.");

    // [2] PIMLICO PAYMASTER CLIENT
    console.log("\n  > [2] Initializing Pimlico Paymaster Client...");
    gasXAddress = gasXDeployment.address as Address;
    mockTargetAddress = mockTargetDeployment.address as Address;

    const pimlicoUrl = `https://api.pimlico.io/v2/${scrollSepolia.id}/rpc?apikey=${PIMLICO_API_KEY}`;
    const paymasterClient = createPimlicoClient({ transport: http(pimlicoUrl) });

    expect(paymasterClient).to.be.an("object").with.property("sponsorUserOperation");
    console.log("    ✅ Pimlico Paymaster Client created and verified successfully.");

    // [3] SMART ACCOUNT CLIENT INITIALIZATION
    console.log("\n  > [3] Initializing Smart Account Client...");
    smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: deployerAccount,
    });
    expect(smartAccount).to.not.equal(undefined); // Verify smartAccount is initialized
    console.log("    ✅ Smart Account created.");
    console.log(`    ✅ Smart Account Address: ${smartAccount.address}`);

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
    expect(smartAccountClient).to.not.equal(undefined); // Verify smartAccountClient is initialized;
    console.log("    ✅ Smart Account Client created.");
    console.log(`    ✅ Smart Account Client Account Address: ${smartAccountClient.account!.address}`);

    // [4] STATE VERIFICATION & CONFIGURATION
    console.log("\n  > [4] Verifying and configuring on-chain state...");

    // [4.1] PAYMASTER OWNERSHIP VERIFICATION
    console.log("    > [4.1] Verifying that the deployer is the owner of the Paymaster...");
    const owner = await publicClient.readContract({
      address: gasXAddress,
      abi: gasXDeployment.abi,
      functionName: "owner",
      args: [],
    });
    if ((owner as Address).toLowerCase() !== deployerAccount.address.toLowerCase()) {
      throw new Error(
        `❌ Fatal Error: Deployer (${deployerAccount.address}) is NOT the owner of the Paymaster. Current owner is ${owner}.`,
      );
    }
    console.log("      ✅ Ownership verified.");

    // 4.2: Verificación del Depósito del Paymaster en el EntryPoint
    console.log("    > 4.2: Verificando depósito del Paymaster...");
    const depositInfo = await publicClient.readContract({
      address: entryPoint08Address,
      abi: entryPoint08Abi,
      functionName: "getDepositInfo",
      args: [gasXAddress],
    });
    console.log(`      ✅ Depósito actual del Paymaster: ${formatEther(depositInfo.deposit)} ETH.`);
    if (depositInfo.deposit < parseEther("0.001")) {
      // Umbral de ejemplo
      console.warn(
        "    ⚠️  ADVERTENCIA: El depósito del Paymaster es muy bajo. El patrocinio podría fallar por falta de fondos.",
      );
    }

    // 4.3: Configuración del Paymaster (Escritura)
    console.log("    > 4.3: Configurando el selector de la función a patrocinar...");
    const walletClient = createWalletClient({
      account: deployerAccount,
      chain: publicClient.chain,
      transport: http(),
    });
    const selectorToWhitelist = toFunctionSelector("execute()");
    const setSelectorTxHash = await walletClient.writeContract({
      address: gasXAddress,
      abi: gasXDeployment.abi,
      functionName: "setSelector",
      args: [selectorToWhitelist, true],
      chain: publicClient.chain,
    });
    console.log(`      > Transacción de escritura enviada: ${setSelectorTxHash}. Esperando confirmación...`);
    await publicClient.waitForTransactionReceipt({ hash: setSelectorTxHash });
    console.log("      ✅ Transacción de 'setSelector' minada.");

    // 4.4: Verificación Post-Escritura
    console.log("    > 4.4: Verificando que el estado del selector se actualizó on-chain...");
    const isWhitelisted = await publicClient.readContract({
      address: gasXAddress,
      abi: gasXDeployment.abi,
      functionName: "allowedSelectors",
      args: [selectorToWhitelist],
    });
    if (!isWhitelisted) {
      throw new Error(
        `❌ Error fatal: La configuración del selector falló. La lectura on-chain después de la transacción indica que el selector ${selectorToWhitelist} NO está en la lista blanca.`,
      );
    }
    console.log("      ✅ El estado del selector ha sido verificado on-chain.");
    console.log("🎉 Fase 4 completada: El Paymaster está verificado y configurado.");
  });

  it("Should execute a sponsored UserOperation", async function () {
    this.timeout(120000);

    console.log("\n🚀 Executing sponsored UserOperation...");

    try {
      // [5] ENCODE CALLDATA AND SEND TRANSACTION
      const callData = encodeFunctionData({ abi: mockTargetDeployment.abi, functionName: "execute", args: [] });

      const userOpHash = await smartAccountClient.sendTransaction({
        account: smartAccountClient.account!,
        chain: publicClient.chain,
        to: mockTargetAddress as Address,
        data: callData,
      });

      console.log(`  > UserOperation sent. Hash: ${userOpHash}`);
      console.log("  > Waiting for transaction to be mined...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: userOpHash });

      expect(receipt.status).to.equal("success");
      console.log("  ✅ Transaction mined successfully! Status:", receipt.status);

      // [6] FINAL VERIFICATION WITH RETRIES
      let counter: any;
      for (let i = 0; i < 5; i++) {
        try {
          console.log(`  > Attempting to read counter (Attempt ${i + 1}/5)...`);
          counter = await publicClient.readContract({
            address: mockTargetAddress as Address,
            abi: mockTargetDeployment.abi,
            functionName: "counter",
            args: [],
          });
          if (counter > 0n) {
            break;
          }
        } catch (e) {
          console.warn(`  > Read attempt ${i + 1} failed. Error: ${e}`);
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      expect(counter).to.be.greaterThan(0n);
      console.log("  ✅ Verified MockTarget was called.");
      console.log("--- TEST END ---\n");
    } catch (error: any) {
      console.error("\n\n❌ ---- EXECUTION ERROR ---- ❌");
      console.error("  > Full Error:", error);
      if (error.cause?.meta?.details) {
        console.error("  > Bundler/Paymaster Details:", error.cause.meta.details);
      }
      console.error("------------------------------------\n\n");
      throw error;
    }
  });
});
