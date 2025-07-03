# 🚀 WalletFuel: Gasless Paymaster

Este documento explica la arquitectura, configuración y despliegue del contrato `WalletFuel`, una implementación de Paymaster compatible con ERC-4337 diseñada para operar bajo subsidio de gas.

---

## 🧱 Arquitectura del Contrato

`WalletFuel` extiende `BasePaymaster` e incluye lógica adicional para controlar:

- Validación vía oráculo externo.
- Modos de entorno (Dev/Testnet/Production).
- Propietario (deployer o multisig).
- Configuración dinámica (dirección externa de `Config`).

### Constructor
```solidity
constructor(
    IEntryPoint _entryPoint,
    address _config,
    address _treasury,
    Environment _environment
)
```

---

## ⚙️ Enum de Entorno

```solidity
enum Environment {
    Dev,
    Testnet,
    Production
}
```

El entorno afecta la verificación del oráculo y se configura dinámicamente al momento del despliegue.

---

## 📦 Deploy Script `02_deploy_walletfuel.ts`

- Determina `EntryPoint`, `Config`, `Treasury` y `Environment` según la red.
- Usa helpers para resolver el entorno automáticamente:

```ts
const environment: Environment = resolveEnvironment(network.name);
```

- Efectúa `addStake` y `deposit()` con cantidades por red:

```ts
await paymaster.addStake(...);
await paymaster.deposit(...);
```

- Direcciones y cantidades configuradas en `CONFIG[chainId]`.

---

## 📁 Helpers Relevantes

### `helpers/environment.ts`

```ts
export enum Environment { Dev = 0, Testnet = 1, Production = 2 }

export function resolveEnvironment(networkName: string): Environment {
  if (networkName === "hardhat" || networkName === "localhost") return Environment.Dev;
  if (["sepolia", "base-sepolia", "scroll-sepolia", "arbitrum-sepolia"].includes(networkName)) return Environment.Testnet;
  return Environment.Production;
}
```

### `scripts/addresses.ts`

Centraliza direcciones por contrato y red:

```ts
getAddress("WalletFuel", chainId);
```

Evita hardcode de direcciones en múltiples scripts.

---

## 🧪 Comando CLI

Tarea personalizada `tasks/showAddress.ts`:

```bash
npx hardhat show-address --contract WalletFuel --network base_sepolia
```

Imprime la dirección desplegada según `DEPLOYED_ADDRESSES`.

---

## ✅ Buenas prácticas

| Área               | Recomendación                            |
|--------------------|-------------------------------------------|
| Deploy             | Usa helpers y lógica centralizada         |
| Entornos           | Usa `resolveEnvironment()` dinámico       |
| Configuración      | Evita valores hardcode, usa helpers       |
| Dirección contratos| Centralizar en `addresses.ts`             |
| Comandos           | Usa tareas `hardhat` personalizadas       |

---

Esto permite mantener despliegues predecibles, entornos separados, y modularidad para escalar nuevas redes o versiones del contrato sin duplicar lógica.

