import { Address, PublicClient, Account, getContract } from "viem";
import { SimpleAccountFactory__factory } from "../typechain-types";

export async function createLocalSmartAccount(
  client: PublicClient,
  owner: Account,
  entryPointAddress: Address,
  simpleAccountFactoryAddress: Address,
): Promise<{ address: Address }> {
  console.log("Using local smart account creation for Hardhat network.");

  const simpleAccountFactory = getContract({
    address: simpleAccountFactoryAddress,
    abi: SimpleAccountFactory__factory.abi,
    client: client,
  });

  // Calculate the counterfactual address of the SimpleAccount
  const salt = 0n; // Using a fixed salt for deterministic address
  const accountAddress = await simpleAccountFactory.read.getAddress([owner.address, salt]);

  // Deploy the account if it doesn't exist
  const code = await client.getBytecode({ address: accountAddress });
  if (code === "0x") {
    console.log(`Deploying SimpleAccount at ${accountAddress}...`);
    const { request } = await simpleAccountFactory.simulate.createAccount([owner.address, salt]);
    const hash = await client.writeContract(request);
    await client.waitForTransactionReceipt({ hash });
    console.log(`SimpleAccount deployed at ${accountAddress}`);
  } else {
    console.log(`SimpleAccount already deployed at ${accountAddress}`);
  }

  return { address: accountAddress };
}
