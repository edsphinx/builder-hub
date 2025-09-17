// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev This contract's sole purpose is to force the Hardhat compiler to generate
 * artifacts for contracts from external dependencies that are only referenced by
 * name in scripts or tests, but not imported by other contracts.
 */
import "@account-abstraction/contracts/core/EntryPoint.sol";

// This file doesn't need to contain any logic.
// The presence of the `import` statement is enough to signal to the
// Hardhat compiler that it needs to compile EntryPoint.sol and
// generate its artifact.
