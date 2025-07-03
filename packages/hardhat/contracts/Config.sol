// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Config {
    address public immutable owner;
    address public oracleSigner; // Public key allowed to sign subsidy payloads

    // Max subsidy allowed per selector (USD in 6 decimals)
    mapping(bytes4 => uint256) public maxUsdPerSelector;

    event OracleUpdated(address newSigner);
    event MaxUsdSet(bytes4 selector, uint256 maxUsd);

    constructor(address _oracleSigner) {
        owner = msg.sender;
        oracleSigner = _oracleSigner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function setOracleSigner(address newSigner) external onlyOwner {
        oracleSigner = newSigner;
        emit OracleUpdated(newSigner);
    }

    function setMaxUsd(bytes4 selector, uint256 maxUsd) external onlyOwner {
        maxUsdPerSelector[selector] = maxUsd;
        emit MaxUsdSet(selector, maxUsd);
    }

    /// @dev Set multiple selector limits in batch
    function bulkSetMaxUsd(bytes4[] calldata selectors, uint256[] calldata maxUsds) external onlyOwner {
        require(selectors.length == maxUsds.length, "length mismatch");
        for (uint256 i = 0; i < selectors.length; i++) {
            maxUsdPerSelector[selectors[i]] = maxUsds[i];
            emit MaxUsdSet(selectors[i], maxUsds[i]);
        }
    }

    function getMaxUsd(bytes4 selector) external view returns (uint256) {
        return maxUsdPerSelector[selector];
    }

    function getAllLimits(bytes4[] calldata selectors) external view returns (uint256[] memory) {
        uint256[] memory results = new uint256[](selectors.length);
        for (uint256 i = 0; i < selectors.length; i++) {
            results[i] = maxUsdPerSelector[selectors[i]];
        }
        return results;
    }
}
