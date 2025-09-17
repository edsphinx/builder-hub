import { ethers, deployments, network } from "hardhat";
import { parseEther } from "viem";
import { entryPoint08Address } from "viem/account-abstraction";

async function main() {
  const networkName = network.name;
  console.log(`\nRunning script on network: ${networkName}`);

  // --- Get Paymaster Deployment ---
  console.log("  > Fetching paymaster deployment...");
  const paymasterDeployment = await deployments.get("GasXWhitelistPaymaster");
  const paymasterAddress = paymasterDeployment.address;
  console.log(`    ✅ Paymaster found at: ${paymasterAddress}`);

  // --- Get EntryPoint Address (Conditionally) ---
  let entryPointAddress: string;
  if (network.name === "hardhat" || network.name === "localhost") {
    console.log("  > Network is local, fetching deployed EntryPoint...");
    const entryPointDeployment = await deployments.get("EntryPoint");
    entryPointAddress = entryPointDeployment.address;
  } else {
    console.log("  > Network is public, using official EntryPoint address from viem...");
    entryPointAddress = entryPoint08Address; // ✅ Use the imported address
  }

  const entryPoint = await ethers.getContractAt("IEntryPoint", entryPointAddress);
  console.log(`    ✅ Using EntryPoint at: ${await entryPoint.getAddress()}`);

  // --- Deposit Funds ---
  const depositAmount = parseEther("0.01");
  console.log(`\n  > Depositing ${ethers.formatEther(depositAmount)} ETH to the Paymaster...`);

  const tx = await entryPoint.depositTo(paymasterAddress, {
    value: depositAmount,
  });

  console.log(`    > Transaction sent: ${tx.hash}. Waiting for confirmation...`);
  await tx.wait();

  // --- Verify Balance ---
  const depositInfo = await entryPoint.getDepositInfo(paymasterAddress);
  console.log(`\n✅ Deposit successful!`);
  console.log(`   New Paymaster deposit in EntryPoint: ${ethers.formatEther(depositInfo.deposit)} ETH`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
