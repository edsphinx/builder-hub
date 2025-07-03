# 🧠 Overview - WalletFuel

**WalletFuel** es un Gasless Paymaster modular desarrollado bajo el estándar [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337). Su objetivo es permitir la ejecución de transacciones sin que el usuario final pague directamente el gas, utilizando validaciones avanzadas y subsidios firmados por oráculos.

Este repositorio está optimizado para:

- testing local con Hardhat
- flujos CI/CD modernos
- despliegues multi-chain
- subsidios dinámicos con parámetros externos
- evolución hacia producción real en Mainnet

---

## ✨ Características principales

- ✅ Compatible con EntryPoint v0.8
- ✅ Implementación de subsidio parcial: `limits.maxGas`, `limits.maxUsd`, `expiry`
- ✅ Firma externa de subsidios con `_verifyOracleSig(...)`
- ✅ Estructura UUPS Upgradeable con `Ownable` y `__gap`
- ✅ Whitelist de selectores para prevenir abuso
- ✅ Lógica desacoplada vía contrato `Config.sol`

---

## 🧱 Stack utilizado

- **Solidity 0.8.24**
- **Hardhat** como entorno de testing y deploy
- **TypeScript** para scripts y tasks
- **Hardhat-deploy** para modularización de despliegues
- **Typechain** para typings automáticos
- **dotenv** para configuración de entorno

---

## 🧩 Arquitectura modular

[ UserOperation ]
↓
[ EntryPoint ]
↓
[ WalletFuel (Paymaster) ]
↓
[ Config (oráculo, parámetros, firmantes, límites) ]

---

## 🔐 Subsidios firmados por oráculo

WalletFuel puede aceptar una transacción solo si:

1. La operación no excede el límite de gas (y/o USD).
2. El subsidio no ha expirado.
3. El subsidio fue firmado por un oráculo autorizado (clave pública registrada en `Config.sol`).
4. El selector de la función está permitido (si `enforceWhitelist = true`).

Esto permite aplicaciones como:

- subsidios temporales a ciertos métodos
- vales de gas para onboarding de usuarios
- reglas de subsidio variables por red, cliente o app

---

## ⚠️ Estado actual

- MVP funcional con lógica de subsidio básica
- Aún no implementado: firma real del oráculo, límites en USD, protecciones de abuso avanzadas

---

## 📚 Documentación relacionada

Consulta los siguientes archivos para más detalles:

- [`walletfuel.md`](./walletfuel.md)
- [`config.md`](./config.md)
- [`testing.md`](./testing.md)
