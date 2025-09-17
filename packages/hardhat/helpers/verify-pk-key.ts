import * as dotenv from "dotenv";
import { Wallet } from "ethers";

dotenv.config();

function verifyCredentials() {
  console.log("🔑 Verificando credenciales del archivo .env...");

  const encryptedKeyJson = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
  const password = process.env.DEPLOYER_PASSWORD;

  if (!encryptedKeyJson || !password) {
    console.error("❌ Error: DEPLOYER_PRIVATE_KEY_ENCRYPTED o DEPLOYER_PASSWORD no están definidas en el entorno.");
    process.exit(1);
  }

  try {
    Wallet.fromEncryptedJsonSync(encryptedKeyJson, password);

    console.log("✅ Secrets successfully verified.");
  } catch (error: any) {
    console.error("❌ Error: Failed to decrypt key. The password secret is likely incorrect.");
    if (error.code === "INVALID_ARGUMENT" && error.argument === "password") {
      console.error("   Detalle del error: Contraseña incorrecta (incorrect password).");
    } else {
      console.error("   Detalle del error:", error.message);
    }
    process.exit(1);
  }
}

verifyCredentials();
