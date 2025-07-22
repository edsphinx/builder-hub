import { useState } from "react";
import { Chain, Hash } from "viem";
import { scrollSepolia } from "viem/chains";
import { useWalletClient } from "wagmi";
import { sendSponsoredTransaction } from "~~/services/web3/permissionlessService";

interface UseGaslessTransactionProps {
  chain?: Chain;
}

export const useGaslessTransaction = ({ chain = scrollSepolia }: UseGaslessTransactionProps = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: walletClient } = useWalletClient({ chainId: chain.id });

  const sendTransaction = async (txDetails: {
    targetAddress: `0x${string}`;
    targetAbi: any;
    functionName: string;
    args?: any[];
  }) => {
    if (!walletClient) {
      setError("Please connect your wallet and switch to the correct network.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const hash = await sendSponsoredTransaction({
        signer: walletClient,
        chain,
        ...txDetails,
      });
      setTxHash(hash);
    } catch (e: any) {
      setError(e.message || "An unknown error occurred.");
      // También es buena práctica loguear el error completo para depuración
      console.error("Gasless transaction failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendTransaction,
    isLoading,
    txHash,
    error,
  };
};
