// This test is designed for public networks (testnet/mainnet) and uses the 'permissionless' library.
import { expect } from "chai";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPublicClient, http, isAddress, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { scrollSepolia } from "viem/chains"; // Import scrollSepolia
import { Wallet } from "ethers";

describe("Account Creation - Public Network Pattern", () => {
  it("should create a smart account by omitting the factoryAddress parameter on public networks", async function () {
    this.timeout(60000);

    const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED!;
    const password = process.env.DEPLOYER_PASSWORD!;
    const _rpc = process.env.RPC_URL!;

    const decryptedWallet = await Wallet.fromEncryptedJson(encryptedKey, password);
    const deployerAccount = privateKeyToAccount(decryptedWallet.privateKey as Hex);

    const publicClient = createPublicClient({
      chain: scrollSepolia, // Use scrollSepolia chain
      transport: http(_rpc),
    });

    try {
      const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: deployerAccount,
      });

      console.log(`\n[PUBLIC TEST] Success! Smart Account Address: ${smartAccount.address}`);
      expect(isAddress(smartAccount.address)).to.equal(true);
    } catch (error: any) {
      console.error("\n[PUBLIC TEST] FAILED:", error);
      expect.fail("This call, following the working pattern, was not expected to fail.");
    }
  });
});
