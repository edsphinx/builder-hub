import { PublicClient, Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { Wallet } from "ethers";

/**
 * Creates a Simple Smart Account for public networks using the permissionless library.
 * This helper assumes the bundler (e.g., Pimlico) automatically handles EntryPoint and Factory addresses.
 * @param client The Viem PublicClient configured for the target public network.
 * @param encryptedKey The encrypted private key of the owner account.
 * @param password The password to decrypt the owner's private key.
 * @returns The created smart account object.
 */
export async function createPublicSmartAccount(
  client: PublicClient,
  encryptedKey: string,
  password: string,
): Promise<Awaited<ReturnType<typeof toSimpleSmartAccount>>> {
  const decryptedWallet = await Wallet.fromEncryptedJson(encryptedKey, password);
  const owner = privateKeyToAccount(decryptedWallet.privateKey as Address);

  const smartAccount = await toSimpleSmartAccount({
    client: client,
    owner: owner,
  });

  return smartAccount;
}
