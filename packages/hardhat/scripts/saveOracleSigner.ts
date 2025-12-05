import "dotenv/config";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import password from "@inquirer/password";

/**
 * @title Save Oracle Signer Script
 * @notice Encrypts and saves an Oracle Signer private key securely
 * @dev Uses ethers.js encrypted JSON keystore format
 *
 * Usage:
 *   NETWORK=arbitrumSepolia SIGNER_PK=0x... yarn ts-node scripts/saveOracleSigner.ts
 */

const SIGNERS_DIR = path.join(__dirname, "..", ".signers");

async function main() {
  const network = process.env.NETWORK;
  const privateKey = process.env.SIGNER_PK;

  if (!network) {
    console.error("❌ NETWORK environment variable required");
    console.log("   Usage: NETWORK=arbitrumSepolia SIGNER_PK=0x... yarn ts-node scripts/saveOracleSigner.ts");
    process.exit(1);
  }

  if (!privateKey) {
    console.error("❌ SIGNER_PK environment variable required");
    process.exit(1);
  }

  // Validate private key
  let wallet: ethers.Wallet;
  try {
    wallet = new ethers.Wallet(privateKey);
  } catch {
    console.error("❌ Invalid private key format");
    process.exit(1);
  }

  console.log("\n🔐 ORACLE SIGNER ENCRYPTION");
  console.log("===========================");
  console.log(`📍 Network: ${network}`);
  console.log(`📍 Address: ${wallet.address}`);
  console.log("");

  // Get password
  const pwd = await password({
    message: "Enter a password to encrypt the private key:",
    mask: "*",
  });

  const confirmPwd = await password({
    message: "Confirm password:",
    mask: "*",
  });

  if (pwd !== confirmPwd) {
    console.error("❌ Passwords do not match");
    process.exit(1);
  }

  console.log("\n⏳ Encrypting... (this may take a moment)");

  // Encrypt the wallet
  const encryptedJson = await wallet.encrypt(pwd);

  // Create signers directory if it doesn't exist
  if (!fs.existsSync(SIGNERS_DIR)) {
    fs.mkdirSync(SIGNERS_DIR, { recursive: true });

    // Create .gitignore in signers directory
    fs.writeFileSync(path.join(SIGNERS_DIR, ".gitignore"), "*\n!.gitignore\n");
  }

  // Save encrypted keystore
  const filename = `oracle-signer-${network}.json`;
  const filepath = path.join(SIGNERS_DIR, filename);
  fs.writeFileSync(filepath, encryptedJson);

  console.log("\n✅ Oracle Signer encrypted and saved!");
  console.log(`📁 File: ${filepath}`);
  console.log("");
  console.log("📝 To use this signer in your backend:");
  console.log("   const encryptedJson = fs.readFileSync('" + filepath + "');");
  console.log("   const wallet = await ethers.Wallet.fromEncryptedJson(encryptedJson, password);");
  console.log("");
  console.log("⚠️  IMPORTANT: Remember your password! It cannot be recovered.");
}

main().catch(console.error);
