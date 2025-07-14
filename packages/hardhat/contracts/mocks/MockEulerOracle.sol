// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEulerOracle {
    function getPrice(address base, address quote) external view returns (uint256);
}

/// @title MockEulerOracle
/// @notice Mock contract for testing EulerOracleAdapter
contract MockEulerOracle is IEulerOracle {
    uint256 public mockPrice;

    constructor(uint256 _mockPrice) {
        mockPrice = _mockPrice;
    }

    function setMockPrice(uint256 _price) external {
        mockPrice = _price;
    }

    function getPrice(address, address) external view override returns (uint256) {
        return mockPrice;
    }
}
