# 🧩 Config.sol — Contrato de Parámetros Externos

Este módulo define el contrato `Config.sol`, pensado para separar la lógica crítica del contrato `WalletFuel` y permitir configuraciones dinámicas en el tiempo sin romper layout de almacenamiento. Aquí se gestiona el `oracleSigner` usado para verificar firmas en subsidios gasless.

---

## 🔍 Propósito

`Config.sol` es un contrato auxiliar, minimalista, que expone parámetros clave mediante funciones `view`. Su objetivo principal es proveer modularidad y facilidad de mantenimiento.

---

## 📄 Implementación

```solidity
interface IConfig {
    function oracleSigner() external view returns (address);
}
```

- ``: devuelve la dirección pública del firmante autorizado por el oráculo. Es utilizada por `WalletFuel` para validar la firma recibida en `paymasterAndData`.

---

## 🔗 Integración con WalletFuel

`WalletFuel` almacena la dirección del contrato `Config` como `immutable`, lo que permite usarlo sin consumir almacenamiento adicional:

```solidity
address public immutable config;
...
address signer = IConfig(config).oracleSigner();
```

Esto se invoca dentro de `_verifyOracleSig(...)` para validar que la firma venga del oráculo correcto.

---

## 🛠️ Despliegue en Scripts

En `deploy/02_deploy_walletfuel.ts`, actualmente se pasa `ethers.ZeroAddress` como placeholder:

```ts
args: [
  entryPointAddress,
  ethers.ZeroAddress, // ← reemplazar con la dirección real de Config
  cfg.paymasterOwner || deployer,
  environment,
]
```

Este argumento debe reemplazarse una vez `Config` haya sido desplegado y su dirección esté registrada.

---

## 🗃️ Dirección por Red

En `scripts/addresses.ts`, las direcciones desplegadas de `Config` están centralizadas por red:

```ts
Config: {
  "31337": "0x...",
  "84532": "0x...",
  "421614": "0x...",
  "1": "0x...",
}
```

Se puede acceder desde cualquier script o task usando:

```ts
import { getAddress } from "../scripts/addresses";
const configAddress = getAddress("Config", chainId);
```

---

## 🧪 Test & Mocking

Durante pruebas locales se puede usar una versión mock de `Config.sol` que devuelva una address controlada. Esto permite tests sin necesidad de firmas reales.

---

## ✅ Beneficios

- **Desacoplamiento**: evita hardcodear direcciones o constantes dentro de `WalletFuel`.
- **Upgrades seguros**: se puede redeplegar `Config` sin afectar el Paymaster.
- **Reusabilidad**: otros contratos pueden también leer los parámetros de `Config`.

---

## 📌 Recomendaciones

- Agrega getter adicionales conforme crezca la necesidad de parámetros dinámicos.
- Protege `Config` con `Ownable` si deseas permitir setters en el futuro.
- Mantén `Config` lo más minimalista posible para facilitar auditorías.

