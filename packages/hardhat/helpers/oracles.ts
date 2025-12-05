import { ethers } from "hardhat";
import { AggregatorFactory } from "../typechain-types";
import { Addressable, EventLog } from "ethers";

export async function getAggregatorOrDeploy(
  factoryAddress: string,
  base: Addressable,
  quote: Addressable,
  oracles: string[],
  maxDeviationBps: number = 500, // default: 5%
): Promise<string> {
  const factory = (await ethers.getContractAt("AggregatorFactory", factoryAddress)) as AggregatorFactory;

  const existing = await factory.getAggregator(await resolveAddress(base), await resolveAddress(quote));
  if (existing && existing !== ethers.ZeroAddress) {
    return existing;
  }

  const tx = await factory.createAggregator(
    await resolveAddress(base),
    await resolveAddress(quote),
    oracles,
    maxDeviationBps,
  );
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }

  const event = receipt.logs.find(
    (log): log is EventLog => log instanceof EventLog && log.fragment?.name === "AggregatorCreated",
  );
  const aggregatorAddress = event?.args?.aggregator ?? ethers.ZeroAddress;

  return aggregatorAddress;
}

async function resolveAddress(input: Addressable): Promise<string> {
  if (typeof input === "string") return input;
  return await input.getAddress();
}
