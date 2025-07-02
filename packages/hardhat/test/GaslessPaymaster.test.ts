// SPDX-License-Identifier: MIT
/**
 * Integration tests – GaslessPaymaster + EntryPoint v0.8
 * -----------------------------------------------------
 * • Deploy EntryPoint, SimpleAccountFactory and GaslessPaymaster from the AA repo (FQN paths).
 * • Create a SimpleAccount for `alice` (salt = 0).
 * • Build a *real* PackedUserOperation using `@account-abstraction/sdk` helpers, so the
 *   signature and gas fields are valid.  That lets us use `simulateValidation` and
 *   `handleOps` without casting to `any`.
 *
 * Requirements (dev‑deps):
 *   yarn add -D @account-abstraction/sdk@0.8.0
 *   yarn add -D @types/chai @types/mocha
 */
import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { GaslessPaymaster, SimpleAccountFactory, SimpleAccount } from "../typechain-types";
import type { Signer } from "ethers";
import { BundlerHelper, fillAndSign, packAccountGasLimits } from "@account-abstraction/sdk";

import EntryPointAbi from "@account-abstraction/contracts/out/core/EntryPoint.sol/EntryPoint.json" assert { type: "json" };
import type { EntryPoint } from "../typechain-types/EntryPoint";

interface TestCtx {
  owner: Signer;
  alice: Signer;
  entryPoint: EntryPoint;
  factory: SimpleAccountFactory;
  account: SimpleAccount;
  paymaster: GaslessPaymaster;
}

describe("GaslessPaymaster – SDK flow", () => {
  const ctx = {} as TestCtx;

  beforeEach(async () => {
    // skip deploy scripts from hardhat‑deploy
    await deployments.fixture([]);

    const [owner, alice] = await ethers.getSigners();
    ctx.owner = owner;
    ctx.alice = alice;

    // 1) EntryPoint v0.8
    const EPFactory = await ethers.getContractFactory(EntryPointAbi.abi, EntryPointAbi.bytecode);
    ctx.entryPoint = (await EPFactory.deploy()) as unknown as EntryPoint;

    // 2) SimpleAccountFactory & account
    const SAF = await ethers.getContractFactory(
      "@account-abstraction/contracts/accounts/SimpleAccountFactory.sol:SimpleAccountFactory",
    );
    ctx.factory = (await SAF.deploy(ctx.entryPoint.getAddress())) as unknown as SimpleAccountFactory;

    const salt = 0n;
    const aliceAddr = await ctx.alice.getAddress();
    const predicted = await ctx.factory.getAddress(aliceAddr, salt);
    await ctx.factory.createAccount(aliceAddr, salt);
    ctx.account = (await ethers.getContractAt(
      "@account-abstraction/contracts/accounts/SimpleAccount.sol:SimpleAccount",
      predicted,
    )) as unknown as SimpleAccount;

    // 3) GaslessPaymaster
    const PMF = await ethers.getContractFactory("GaslessPaymaster");
    ctx.paymaster = await PMF.deploy(ctx.entryPoint.getAddress(), ethers.ZeroAddress, await owner.getAddress());

    await ctx.paymaster.addStake(86_400, { value: ethers.parseEther("0.1") });
    await ctx.paymaster.deposit({ value: ethers.parseEther("0.2") });
    await ctx.paymaster.setSelector("0x12345678", true);
    await ctx.paymaster.setLimit(150_000, 0);
  });

  /** Helper – build & sign a minimal UserOp */
  async function userOp(selector: string, pData: string, callGas = 120_000n) {
    const helper = new BundlerHelper(ethers.provider, await ctx.entryPoint.getAddress());
    const op = await fillAndSign(
      {
        sender: await ctx.account.getAddress(),
        callData: selector,
        accountGasLimits: packAccountGasLimits({ callGasLimit: callGas }),
        paymasterAndData: pData,
      },
      ctx.alice,
      helper,
    );
    return op;
  }

  it("selector ✗ whitelist", async () => {
    const op = await userOp("0xdeadbeef", "0x");
    await expect(ctx.entryPoint.simulateValidation(op)).to.be.revertedWith("func!");
  });

  it("gas ✗ ceiling", async () => {
    const op = await userOp("0x12345678", "0x", 200_000n);
    await expect(ctx.entryPoint.simulateValidation(op)).to.be.revertedWith("gas!");
  });

  it("happy‑path → GasSponsored", async () => {
    const op = await userOp("0x12345678", "0x");
    await ctx.entryPoint.simulateValidation(op);
    await expect(ctx.entryPoint.handleOps([op], await ctx.owner.getAddress())).to.emit(ctx.paymaster, "GasSponsored");
  });

  it("expiry ✗ old", async () => {
    const past = BigInt(Math.floor(Date.now() / 1000) - 60);
    const hex12 = ethers.toBeHex(past, 12);
    const pData = ctx.paymaster.getAddress() + hex12.slice(2);
    const op = await userOp("0x12345678", pData);
    await expect(ctx.entryPoint.simulateValidation(op)).to.be.revertedWith("expired!");
  });
});
