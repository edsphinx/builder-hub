import * as dotenv from "dotenv";
dotenv.config();
import { Wallet } from "ethers";

async function main() {
  const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
  if (!encryptedKey) {
    console.error("🚫️ DEPLOYER_PRIVATE_KEY_ENCRYPTED is not set in .env");
    process.exit(1);
  }

  const pass = process.env.DEPLOYER_PASSWORD;
  if (!pass) {
    console.error("🚫️ DEPLOYER_PASSWORD is not set in .env");
    process.exit(1);
  }

  try {
    const wallet = await Wallet.fromEncryptedJson(encryptedKey, pass);
    console.log(wallet.address);
  } catch {
    console.error("❌ Failed to decrypt private key. Wrong password?");
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
