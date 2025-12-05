import { Address, PublicClient, Account, getContract, Chain, Transport, WalletClient } from "viem";
import { SimpleAccountFactory__factory } from "../typechain-types";

export async function createLocalSmartAccount(
  client: PublicClient,
  walletClient: WalletClient<Transport, Chain, Account>,
  owner: Account,
  entryPointAddress: Address,
  simpleAccountFactoryAddress: Address,
): Promise<{ address: Address }> {
  // Silence unused variable warning - entryPointAddress needed for future extensions
  void entryPointAddress;

  const simpleAccountFactory = getContract({
    address: simpleAccountFactoryAddress,
    abi: SimpleAccountFactory__factory.abi,
    client: client,
  });

  const salt = 0n;
  const accountAddress = await simpleAccountFactory.read.getAddress([owner.address, salt]);

  const code = await client.getBytecode({ address: accountAddress });
  if (code === "0x" || !code) {
    const { request } = await simpleAccountFactory.simulate.createAccount([owner.address, salt]);
    const hash = await walletClient.writeContract(request);
    await client.waitForTransactionReceipt({ hash });
  }

  return { address: accountAddress };
}
