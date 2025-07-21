# 📘 Documentación Técnica - WalletFuel

Este repositorio contiene la implementación de un sistema modular ERC-4337 con lógica de subsidios dinámicos, firmado por oráculos, y funciones avanzadas de Paymaster. Está estructurado para ser extensible y compatible con flujos CI/CD, testing local y despliegues multi-red.

---

## Índice de Documentos

### 🧠 Conceptos Principales

- [`docs/overview.md`](./overview.md): Introducción general a WalletFuel y ERC-4337.
- [`docs/dev-vs-prod.md`](./dev-vs-prod.md): Uso de bandera global de entorno (develop vs producción).

### ⚙️ Contratos

- [`docs/walletfuel.md`](./walletfuel.md): Paymaster principal WalletFuel.sol
- [`docs/config.md`](./config.md): Contrato de configuración externa (Config.sol)
- [`docs/testable.md`](./testable.md): Contrato extendido para testing (TestableWalletFuel)

### 🧪 Testing

- [`docs/testing.md`](./testing.md): Pruebas disponibles, test harness y validaciones

### 🚀 Despliegues y Configuración

- [`docs/deploy.md`](./deploy.md): Scripts de deploy por red (walletfuel, config)
- [`docs/addresses.md`](./addresses.md): Centralización de direcciones y helpers

### 📂 Scripts

- [`docs/scripts.md`](./scripts.md): Uso de:
  - `loadAndSetMaxUsd.ts`
  - `bulkSetMaxUsd.ts`
  - `setMaxUsd.ts`
  - `useConfig.ts`

### 🛠️ Tareas CLI

- [`docs/tasks.md`](./tasks.md): Custom Hardhat tasks:
  - `show-address`
  - `set-max-usd`
  - Otros CLI helpers para scripting

---

## 📦 Estructura del Repositorio

```
packages/hardhat
├── contracts/
│   ├── WalletFuel.sol
│   ├── Config.sol
│   └── test/TestableWalletFuel.sol
├── deploy/
│   ├── 01_deploy_config.ts
│   └── 02_deploy_walletfuel.ts
├── helpers/
│   └── env.ts (bandera de entorno y helpers comunes)
├── scripts/
│   ├── addresses.ts
│   ├── bulkSetMaxUsd.ts
│   ├── loadAndSetMaxUsd.ts
│   ├── setMaxUsd.ts
│   └── useConfig.ts
├── tasks/
│   └── (custom hardhat tasks)
└── hardhat.config.ts
```

---

## 🔗 Recomendaciones de Uso

- Cloná este repo con `--recursive` si se usa submodules.
- Revisá `README.md` para los comandos básicos de testing y deploy.
- Usá `NODE_ENV=production` para activar la lógica de entorno productivo.
- Verificá las direcciones usando `npx hardhat show-address --contract GasX --network base_sepolia`

---

## 📄 Próximos documentos a incluir

- docs/security.md (validaciones, límites, prevención de abuso)
- docs/grants.md (pitch para grants y documentación de motivación)
- docs/api.md (si se expone una API externa o REST helper)

---

¿Necesitás extender algún archivo? Abrí el `.md` correspondiente y usá el índice como guía para continuar.

