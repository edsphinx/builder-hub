"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { SmartAccountClient, createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createPublicClient, encodeFunctionData, http } from "viem";
import { scrollSepolia } from "viem/chains";
import { useAccount, useWalletClient } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

type SimpleSmartAccount = Awaited<ReturnType<typeof toSimpleSmartAccount>>;

const GaslessPage: NextPage = () => {
  let smartAccount: SimpleSmartAccount;
  let smartAccountClient: SmartAccountClient;
  const { address: userAddress, chain: userChain } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  const { data: walletClient } = useWalletClient({ chainId: scrollSepolia.id });
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendTransaction = async () => {
    console.log("--- Iniciando Transacción ---");
    console.log("Dirección de usuario:", userAddress);
    console.log("Chain del usuario:", userChain);
    console.log("WalletClient (firmante):", walletClient);
    console.log("Target Network:", targetNetwork);

    if (!userAddress || !walletClient) {
      setError("Please connect your wallet.");
      return;
    }

    if (userChain!.id !== scrollSepolia.id) {
      setError(`Please switch to Scroll Sepolia (current: ${userChain!.name}).`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // [1] CLIENTS AND ACCOUNTS SETUP
      const publicClient = createPublicClient({
        chain: scrollSepolia,
        transport: http(),
      });

      const pimlicoUrl = `https://api.pimlico.io/v2/${scrollSepolia.id}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;
      const paymasterClient = createPimlicoClient({ transport: http(pimlicoUrl) });

      smartAccount = await toSimpleSmartAccount({
        owner: walletClient,
        client: publicClient,
      });

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

      console.log("    ✅ Smart Account Client created.");
      console.log(`    ✅ Smart Account Client Account Address: ${smartAccountClient}`);

      // [2] ENCODE CALLDATA
      const mockTargetAddress = deployedContracts[scrollSepolia.id].MockTarget.address;
      const mockTargetAbi = deployedContracts[scrollSepolia.id].MockTarget.abi;

      const callData = encodeFunctionData({
        abi: mockTargetAbi,
        functionName: "execute",
        args: [],
      });

      // [3] SEND THE USEROPERATION
      const userOpHash = await smartAccountClient.sendTransaction({
        account: smartAccount,
        chain: scrollSepolia,
        to: mockTargetAddress,
        data: callData,
      });

      console.log("UserOperation Hash:", userOpHash);
      setTxHash(userOpHash);

      // [4] WAIT FOR TRANSACTION RECEIPT
      const receipt = await publicClient.waitForTransactionReceipt({ hash: userOpHash });

      console.log("Recibo de la transacción:", receipt);
      if (receipt.status !== "success") {
        throw new Error(`Transaction failed: ${receipt.status}`);
      }
    } catch (e: any) {
      // 🐛 DEBUG: Log del error completo en la consola
      console.error("--- Error Capturado ---", e);
      setError(e.message || "An unknown error occurred.");
    } finally {
      console.log("--- Finalizando Transacción ---");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <div className="px-5">
        <h1 className="text-center">
          <span className="block text-2xl mb-2">Gasless Transactions</span>
          <span className="block text-4xl font-bold">Sponsor a Transaction on Scroll Sepolia</span>
        </h1>
        <p className="text-center text-lg">
          Click the button below to send a test transaction sponsored by our GasX Paymaster.
        </p>
      </div>

      <div className="flex-grow bg-base-300 w-full mt-16 px-8 py-12">
        <div className="flex justify-center items-center gap-12 flex-col sm:flex-row">
          <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
            <p>Click the button to send a sponsored transaction to our MockTarget contract.</p>
            <button className="btn btn-primary mt-4" onClick={handleSendTransaction} disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Sponsored Transaction"}
            </button>
            {txHash && (
              <div className="mt-4">
                <p>Transaction Hash: {txHash}</p>
                <a href={`https://sepolia.scrollscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
                  View on Scrollscan
                </a>
              </div>
            )}
            {error && <p className="text-red-500 mt-4">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GaslessPage;
