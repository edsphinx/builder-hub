import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { Address, Chain, Hash, WalletClient, createPublicClient, encodeFunctionData, http } from "viem";

interface SendSponsoredTransactionParams {
  signer?: WalletClient;
  chain: Chain;
  targetAddress: Address;
  targetAbi: any;
  functionName: string;
  args?: any[];
}

export const sendSponsoredTransaction = async ({
  signer,
  chain,
  targetAddress,
  targetAbi,
  functionName,
  args = [],
}: SendSponsoredTransactionParams): Promise<Hash> => {
  if (!signer) {
    throw new Error("A signer (WalletClient) is required to send a transaction.");
  }

  const pimlicoUrl = `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;

  const publicClient = createPublicClient({
    chain: chain,
    transport: http(),
  });

  const paymasterClient = createPimlicoClient({ transport: http(pimlicoUrl) });

  const smartAccount = await toSimpleSmartAccount({
    owner: signer as any,
    client: publicClient,
  });

  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain: chain,
    bundlerTransport: http(pimlicoUrl),
    paymaster: paymasterClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await paymasterClient.getUserOperationGasPrice()).fast;
      },
    },
  });

  const callData = encodeFunctionData({
    abi: targetAbi,
    functionName,
    args,
  });

  const userOpHash = await smartAccountClient.sendTransaction({
    account: smartAccount,
    chain: chain,
    to: targetAddress,
    data: callData,
  });

  await publicClient.waitForTransactionReceipt({ hash: userOpHash });

  return userOpHash;
};
