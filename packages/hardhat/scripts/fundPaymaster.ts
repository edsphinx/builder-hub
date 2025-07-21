import { ethers } from "hardhat";
import { parseEther } from "viem";
import { entryPoint08Address } from "viem/account-abstraction";
import gasXDeployment from "../deployments/scrollSepolia/GasX.json";

async function main() {
  const paymasterAddress = gasXDeployment.address;
  const depositAmount = parseEther("0.1"); // Envía 0.1 ETH, por ejemplo

  const entryPoint = await ethers.getContractAt("IEntryPoint", entryPoint08Address);

  console.log(`Depositando ${ethers.formatEther(depositAmount)} ETH para el Paymaster ${paymasterAddress}...`);

  const tx = await entryPoint.depositTo(paymasterAddress, {
    value: depositAmount,
  });

  console.log(`Transacción enviada: ${tx.hash}. Esperando confirmación...`);
  await tx.wait();

  console.log("✅ Depósito realizado con éxito!");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
