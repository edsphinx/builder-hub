# Future Features and Architectural Considerations

This document outlines potential future features and architectural considerations for the Builder-Hub project, particularly focusing on enhancing the GasX Paymaster module to support flexible user identification strategies and broader dApp adaptability.

## 1. Vision for the GasX Paymaster

The ultimate goal is to evolve the GasX Paymaster into a highly adaptable module that can sponsor gas for users of any dApp, with eligibility determined by various on-chain and off-chain strategies. These strategies could include:

- **Token/NFT Holders:** Sponsoring gas for users holding specific ERC-20 tokens or NFTs.
- **Attestations:** Leveraging on-chain attestations (e.g., from EAS) to identify eligible users.
- **Protocol Usage History:** Identifying users based on their past interactions with specific protocols (e.g., used a DeFi protocol X times, or within a certain timeframe).
- **Whitelisting/Blacklisting:** More granular control over user eligibility.

## 2. Current Architecture Limitations for Future Vision

While the current architecture provides a solid foundation, certain aspects limit its immediate support for the advanced strategies outlined above:

- **Hardcoded Validation Logic:** The `WalletFuel.sol` contract's `_validatePaymasterUserOp` function primarily focuses on `allowedSelectors` and gas limits. It lacks built-in mechanisms to query complex user eligibility criteria.
- **Limited `WalletFuelConfig` Scope:** The `WalletFuelConfig.sol` currently stores only `oracleSigner` and `maxUsdPerSelector`. It would need to be extended to store references to eligibility rules or external validation contracts.
- **Off-chain Data Integration:** Strategies relying on off-chain data (e.g., protocol usage history from subgraphs, attestations from external services) require a secure and verifiable bridge to on-chain validation.
- **Static `allowedSelectors`:** The current `allowedSelectors` mechanism is manual. For broad dApp adaptability, a more dynamic or permissionless approach might be desired.

## 3. Proposed Future Features and Architectural Changes

To achieve the vision, the following features and architectural modifications are proposed:

### 3.1. User Eligibility Module (High Priority)

- **Concept:** Introduce a new, pluggable module responsible for determining user eligibility based on various criteria.
- **Architectural Impact:**
  - **New Contract:** A dedicated `UserEligibilityModule.sol` (or similar) contract that `WalletFuel` can query.
  - **Interfaces:** Define interfaces (e.g., `IEligibilityProvider`) for different types of eligibility checks (e.g., `isTokenHolder(address user, address token, uint256 minAmount)`).
  - **`WalletFuel` Integration:** `WalletFuel`'s `_validatePaymasterUserOp` would be modified to call this module, passing relevant user and context data.
  - **`WalletFuelConfig` Extension:** `WalletFuelConfig` would store mappings from `selector` or `dAppId` to `EligibilityProvider` addresses and associated rule parameters.
- **Examples of Eligibility Providers:**
  - `ERC20HolderEligibility`: Checks if a user holds a minimum amount of a specific ERC-20 token.
  - `NFTHolderEligibility`: Checks if a user holds a specific NFT or belongs to an NFT collection.
  - `AttestationEligibility`: Verifies on-chain attestations for a user.
  - `ProtocolUsageEligibility`: (Requires off-chain data integration) Checks user's past interactions with a protocol.

### 3.2. Dynamic Selector Whitelisting

- **Concept:** Allow dApps to dynamically register their function selectors for sponsorship, potentially through a governance mechanism or a fee-based system.
- **Architectural Impact:**
  - **Registry Contract:** A new `SelectorRegistry.sol` contract where dApps can register/unregister selectors.
  - **`WalletFuel` Integration:** `WalletFuel` would query this registry instead of its internal `allowedSelectors` mapping.

### 3.3. Off-chain Data Integration for Eligibility

- **Concept:** Securely integrate off-chain data (e.g., from subgraphs, data providers) into on-chain eligibility checks.
- **Architectural Impact:**
  - **Oracle for Off-chain Data:** Similar to price oracles, a new type of oracle (`IOffchainDataProvider`) that can provide verifiable proofs of off-chain data on-chain.
  - **Proof Verification:** Eligibility modules would include logic to verify these proofs.

### 3.4. Multi-dApp / Shared Paymaster Model

- **Concept:** Allow multiple dApps to share a single Paymaster instance, with each dApp having its own set of rules and configurations.
- **Architectural Impact:**
  - **dApp Registry:** A `dAppRegistry.sol` to map dApp addresses to their specific configurations.
  - **Contextual Validation:** `WalletFuel` would need to interpret the `UserOperation` to determine the dApp context and apply the correct eligibility rules.

## 4. Prioritization

- **High Priority:** User Eligibility Module (3.1) is foundational for the vision.
- **Medium Priority:** Dynamic Selector Whitelisting (3.2) and Off-chain Data Integration (3.3) are critical for scalability and advanced eligibility.
- **Lower Priority:** Multi-dApp / Shared Paymaster Model (3.4) can be built upon the other features.

## 5. Next Steps

- Define clear interfaces for eligibility providers.
- Develop a proof-of-concept for a simple `ERC20HolderEligibility` provider.
- Refactor `GasX` to accept a configurable eligibility module.

---

## 6. Signature-Based Sponsorship (Industry Standard Pattern)

- **Concept:** Instead of relying on on-chain whitelists or complex eligibility modules, adopt a more standard and powerful signature-based sponsorship model. This is the pattern used by major providers like Pimlico and Alchemy.
- **How it Works:**
  1. A dApp backend, which wants its users' transactions sponsored, validates a user's action based on its own internal logic (e.g., is the user a premium member, have they exceeded their daily quota, etc.).
  2. If the action is valid, the dApp backend uses a secure, authorized private key (the "oracle signer") to sign the `userOpHash`.
  3. This signature is passed back to the user's frontend.
  4. The user submits the `UserOperation` to the bundler, including the dApp's signature in the `paymasterAndData` field.
  5. Our `GasX` paymaster receives the `UserOperation`. In `_validatePaymasterUserOp`, it recovers the address from the signature and checks if it matches the authorized `oracleSigner` address stored in its configuration.
  6. If the signature is valid, the operation is sponsored.
- **Architectural Impact:**
  - **Simplifies `GasX`:** The paymaster's logic becomes much simpler. It only needs to be able to verify a signature against a known signer address. All the complex dApp-specific logic moves off-chain to the dApp's backend.
  - **Enhances `GasXConfig`:** The `GasXConfig` contract would primarily be used to manage the list of authorized oracle signer addresses.
  - **Requires dApp Backend:** This pattern requires dApps to have a backend component to handle the signing, which is a standard practice for production applications.
- **Priority:** **High.** This is the most scalable, secure, and industry-aligned path forward for generalizing the paymaster.

---

## 8. Script Naming Convention for Bundler Integrations

To maintain clarity and organization as we integrate with various bundler providers (e.g., Pimlico, Alchemy), we will adopt a standardized naming convention for scripts that are specific to a particular bundler's SDK or API.

**Convention:** `scriptName.<bundlerProvider>.ts`

**Examples:**
- `sendUserOp.pimlico.ts` (for a script using Pimlico's SDK)
- `sendUserOp.alchemy.ts` (for a script using Alchemy's SDK)
- `fundPaymaster.pimlico.ts` (if a script specifically funds a Pimlico-related paymaster)

This convention will help future developers quickly identify the purpose and dependencies of each bundler-specific script.

---

## 7. Known Issues

### 6.1. `permissionless` Library Integration in Hardhat Tests

**Problem:** Persistent `TypeError: createPimlicoPaymasterClient is not a function` when attempting to run integration tests or standalone scripts using the `permissionless` library (specifically version `0.2.49`) within the Hardhat environment.

**Symptoms:**

- `TypeError: (0 , pimlico_1.createPimlicoPaymasterClient) is not a function`
- `ReferenceError: pimlicoActions is not defined` (when using wildcard imports)
- `No matching export` errors during `esbuild` compilation.

**Attempted Solutions (and their outcomes):**

1. **Correcting import paths:** Tried `permissionless/clients/pimlico` and `permissionless/actions/pimlico`. Neither resolved the issue.
2. **Fixing `permissionless` version:** Ensured `0.2.49` was explicitly installed. No change.
3. **Configuring `ts-node` for ESM:** Modified `tsconfig.json` and `package.json` to enable ESM support for `ts-node`. This led to new module resolution errors or did not resolve the original `TypeError`.
4. **Using wildcard imports (`import * as ...`):** Attempted to import the entire module and access the function as a property. This resulted in `ReferenceError: pimlicoActions is not defined`, indicating a fundamental issue with module resolution/transpilation.
5. **Creating a standalone ESM package (`paymaster-client`) with `esbuild`:** Even with a dedicated ESM package and `esbuild` for bundling, the `No matching export` errors persisted, suggesting the issue lies in how `permissionless@0.2.49` exports its functions or how it's interpreted by modern bundlers/transpilers.

**Current Understanding:** The problem appears to be a deep incompatibility or a specific packaging issue with `permissionless@0.2.49` when used in a TypeScript/ESM context within a Hardhat/Node.js environment. The library's exports might not be correctly interpreted by `ts-node` or `esbuild` for this version.

**Recommendation:**

- Further investigation into `permissionless` library's internal structure for version `0.2.49` or consulting the `permissionless` community for known compatibility issues with Hardhat/ESM setups.
- Consider using a different version of `permissionless` if available, or exploring alternative libraries for Paymaster client interactions if this issue remains a blocker.
- For now, manual validation of the Paymaster MVP can be performed using the `packages/hardhat/scripts/sponsorship_standalone.ts` script.
