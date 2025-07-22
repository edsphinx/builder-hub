"use client";

import type { NextPage } from "next";
import { scrollSepolia } from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";
import { useGaslessTransaction } from "~~/hooks/gasx/useGaslessTransaction";

const GaslessPage: NextPage = () => {
  const { sendTransaction, isLoading, txHash, error } = useGaslessTransaction({
    chain: scrollSepolia,
  });

  const handleSendTransaction = () => {
    const { MockTarget } = deployedContracts[scrollSepolia.id];

    sendTransaction({
      targetAddress: MockTarget.address,
      targetAbi: MockTarget.abi,
      functionName: "execute",
      args: [],
    });
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
