// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AggregatorFactory
 * @author blocketh
 * @notice Deploys and manages MultiOracleAggregator contracts per asset pair.
 *         - Each pair (base/quote) has its own aggregator instance.
 *         - Owner can register or remove aggregators.
 *         - Supports direct initialization with oracles and settings.
 * @dev Compatible with the current MultiOracleAggregator design.
 */

import { MultiOracleAggregator } from "../oracles/MultiOracleAggregator.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";

contract AggregatorFactory {
    address public immutable owner;

    // Mapping from base ⇒ quote ⇒ aggregator instance
    mapping(address => mapping(address => address)) public aggregators;

    event AggregatorCreated(address indexed base, address indexed quote, address aggregator);
    event AggregatorRemoved(address indexed base, address indexed quote);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createAggregator(
        address base,
        address quote,
        address[] calldata oracles,
        uint256 maxDeviationBps
    ) external onlyOwner returns (address aggregator) {
        require(aggregators[base][quote] == address(0), "already exists");

        MultiOracleAggregator agg = new MultiOracleAggregator();
        for (uint256 i = 0; i < oracles.length; i++) {
            agg.addOracle(base, quote, oracles[i]);
        }
        agg.setMaxDeviationBps(maxDeviationBps);

        aggregators[base][quote] = address(agg);
        emit AggregatorCreated(base, quote, address(agg));
        return address(agg);
    }

    function removeAggregator(address base, address quote) external onlyOwner {
        address aggregator = aggregators[base][quote];
        require(aggregator != address(0), "not found");
        delete aggregators[base][quote];
        emit AggregatorRemoved(base, quote);
    }

    function getAggregator(address base, address quote) external view returns (address) {
        return aggregators[base][quote];
    }
}
