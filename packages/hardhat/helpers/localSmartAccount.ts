import { Address, PublicClient, Account, getContract } from "viem";
import { SimpleAccountFactory__factory } from "../typechain-types";

export async function createLocalSmartAccount(
  client: PublicClient,
  owner: Account,
  entryPointAddress: Address,
  simpleAccountFactoryAddress: Address,
): Promise<{ address: Address }> {
  const simpleAccountFactory = getContract({
    address: simpleAccountFactoryAddress,
    abi: SimpleAccountFactory__factory.abi,
    client: client,
  });

  const salt = 0n;
  const accountAddress = await simpleAccountFactory.read.getAddress([owner.address, salt]);

  const code = await client.getBytecode({ address: accountAddress });
  if (code === "0x") {
    const { request } = await simpleAccountFactory.simulate.createAccount([owner.address, salt]);
    const hash = await client.writeContract(request);
    await client.waitForTransactionReceipt({ hash });
  }

  return { address: accountAddress };
}
