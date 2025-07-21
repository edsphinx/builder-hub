# ⚙️ Entorno: Desarrollo vs Producción

Este documento detalla cómo se maneja la separación de entornos (`Dev`, `Testnet`, `Production`) dentro del contrato `WalletFuel`, utilizando una enumeración, condiciones específicas y helpers auxiliares tanto en Solidity como en TypeScript.

---

## 🔧 Implementación en Solidity

Dentro de `WalletFuel.sol`, se declara una enumeración pública que representa el entorno actual:

```solidity
enum Environment {
    Dev,
    Testnet,
    Production
}

Environment public environment;
```

Se inicializa en el constructor del contrato:

```solidity
constructor(
    IEntryPoint _entryPoint,
    address _config,
    address _treasury,
    Environment _environment
) BasePaymaster(_entryPoint) {
    config = _config;
    treasury = _treasury;
    environment = _environment;
    _transferOwnership(msg.sender);
}
```

También se incluye un helper:

```solidity
function isDev() public view returns (bool) {
    return environment == Environment.Dev;
}
```

---

## 🧪 Uso en Validación

En la función `_verifyOracleSig(...)`, se omite la verificación si el contrato está en entorno Dev:

```solidity
if (isDev()) {
    return; // Skip signature check in dev mode
}
```

Esto permite facilitar testing local sin requerir firma del oráculo.

---

## ⚙️ Configuración Dinámica por Red (deploy script)

En `deploy/02_deploy_walletfuel.ts`, el entorno se determina automáticamente mediante:

```ts
import { resolveEnvironment, getEnvironmentName } from "../helpers/environment";
...
const environment: Environment = resolveEnvironment(network.name);
```

Luego se pasa al constructor:

```ts
args: [
	entryPointAddress,
	ethers.ZeroAddress, // reemplazar con Config address real
	cfg.paymasterOwner || deployer,
	environment,
];
```

---

## 🧠 Helper Centralizado de Entornos

Ubicado en `helpers/environment.ts`:

```ts
export enum Environment {
	Dev = 0,
	Testnet = 1,
	Production = 2,
}

export function resolveEnvironment(networkName: string): Environment {
	if (networkName === 'hardhat' || networkName === 'localhost')
		return Environment.Dev;

	if (
		[
			'sepolia',
			'base-sepolia',
			'scroll-sepolia',
			'zksync-testnet',
			'arbitrum-sepolia',
		].includes(networkName)
	)
		return Environment.Testnet;

	return Environment.Production;
}
```

Esto permite escalar el número de redes sin tocar el contrato.

---

## 🗃️ Dirección centralizada por red

Se centralizan las direcciones desplegadas en `scripts/addresses.ts`:

```ts
export const DEPLOYED_ADDRESSES = {
  WalletFuel: {
    "31337": "0x...",
    "84532": "0x...",
    ...
  },
  Config: {
    "31337": "0x...",
    "84532": "0x...",
    ...
  },
};
```

Y se expone el helper:

```ts
export function getAddress(contract: ContractName, chainId: number): string {
  ... // valida y devuelve la dirección correcta
}
```

---

## 📋 Comando para verificar dirección desplegada

Mediante `tasks/showAddress.ts`:

```bash
yarn hardhat show-address --contract GasX --network localhost
```

Esto imprime la dirección directamente desde el mapa de helpers.

---

## ✅ Comparación Dev vs. Production

| Comportamiento     | Dev (0)                           | Production (2) |
| ------------------ | --------------------------------- | -------------- |
| Oracle signature   | Omitida                           | Obligatoria    |
| `isDev()`          | true                              | false          |
| `isProd()`         | false                             | true           |
| Seguridad estricta | No                                | Sí             |
| Deploy script      | `resolveEnvironment()` automático |

---

## 🛡️ Recomendaciones Finales

- Usar `Dev` para testeo y simulaciones.
- Validar entorno mediante `resolveEnvironment()`.
- No hacer hardcode de enums en scripts. Usa helpers centralizados.
- Centralizar direcciones en `addresses.ts` y comandos CLI.

Esto garantiza una separación clara y segura entre ambientes, permite automatización en despliegues y reduce errores humanos durante el ciclo de vida del proyecto.
