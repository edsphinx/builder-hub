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
  if (!receipt || !receipt.logs) {
    throw new Error("Transaction receipt or logs is null");
  }

  // Find the AggregatorCreated event in logs
  let aggregatorAddress = ethers.ZeroAddress;
  for (const log of receipt.logs) {
    if (log instanceof EventLog && log.fragment && log.fragment.name === "AggregatorCreated") {
      aggregatorAddress = log.args?.aggregator ?? ethers.ZeroAddress;
      break;
    }
  }

  return aggregatorAddress;
}

async function resolveAddress(input: Addressable): Promise<string> {
  if (typeof input === "string") return input;
  return await input.getAddress();
}
