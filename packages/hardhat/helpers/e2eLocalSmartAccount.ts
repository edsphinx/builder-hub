import { Address, PublicClient, Account, Hex, encodeFunctionData, WalletClient } from "viem";
import { createLocalSmartAccount } from "./localSmartAccount"; // Import the existing helper
import { SimpleAccountFactory__factory } from "../typechain-types"; // Needed for ABI

/**
 * Creates a Smart Account object specifically for E2E local tests,
 * extending the base functionality from createLocalSmartAccount with
 * methods expected by SmartAccountClient (encodeCalls, getFactoryArgs).
 * @param client The Viem PublicClient.
 * @param walletClient The Viem WalletClient for write operations.
 * @param owner The owner account.
 * @param entryPointAddress The EntryPoint contract address.
 * @param simpleAccountFactoryAddress The SimpleAccountFactory contract address.
 * @returns A SmartAccount-like object with necessary methods for SmartAccountClient.
 */
export async function createE2ELocalSmartAccount(
  client: PublicClient,
  walletClient: WalletClient,
  owner: Account,
  entryPointAddress: Address,
  simpleAccountFactoryAddress: Address,
) {
  // Use the existing, stable helper to get the base account
  const baseAccount = await createLocalSmartAccount(
    client,
    walletClient,
    owner,
    entryPointAddress,
    simpleAccountFactoryAddress,
  );

  // Simulate encodeCalls for local testing
  const encodeCalls = async (calls: { to: Address; value?: bigint; data?: Hex }[]): Promise<Hex> => {
    if (calls.length === 0) {
      return "0x";
    }
    // This is a simplified representation. A real SimpleAccount would have a specific ABI for execute.
    // For now, we'll just return the data of the first call.
    return calls[0].data || "0x";
  };

  // Simulate getFactoryArgs for local testing
  const getFactoryArgs = (): [Address, Hex] => {
    // This is a simplified representation.
    return [
      simpleAccountFactoryAddress,
      encodeFunctionData({
        abi: SimpleAccountFactory__factory.abi,
        functionName: "createAccount",
        args: [owner.address, 0n], // Assuming salt is 0n as in localSmartAccount
      }),
    ];
  };

  return {
    ...baseAccount, // Spread the properties from the base account (like 'address')
    encodeCalls: encodeCalls,
    getFactoryArgs: getFactoryArgs,
  };
}
