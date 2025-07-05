// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MultiOracleAggregator } from "../oracles/MultiOracleAggregator.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";

/**
 * @title AggregatorFactory
 * @author blocketh
 * @notice Deploys and manages MultiOracleAggregator contracts per asset pair.
 *         Each (base, quote) pair gets its own aggregator instance.
 * @dev Designed for compatibility with MultiOracleAggregator and oracle adapters conforming to IPriceOracle.
 */
contract AggregatorFactory {
    /// @notice Owner address with permissions to create and remove aggregators
    address public immutable owner;

    /// @notice Mapping from base token ⇒ quote token ⇒ aggregator address
    mapping(address => mapping(address => address)) public aggregators;

    // ────────────────────────────────────────────────
    // ░░  EVENTS
    // ────────────────────────────────────────────────

    /**
     * @notice Emitted when a new aggregator is deployed
     * @param base Address of the base token
     * @param quote Address of the quote token
     * @param aggregator Address of the deployed aggregator
     */
    event AggregatorCreated(address indexed base, address indexed quote, address aggregator);

    /**
     * @notice Emitted when an aggregator is removed
     * @param base Address of the base token
     * @param quote Address of the quote token
     */
    event AggregatorRemoved(address indexed base, address indexed quote);

    /**
     * @notice Emitted when the ownership of an aggregator is transferred to a new address
     * @param base Address of the base token
     * @param quote Address of the quote token
     * @param newOwner New owner address
     */
    event AggregatorOwnershipTransferred(address indexed base, address indexed quote, address newOwner);

    /**
     * @notice Emitted when the max deviation for an aggregator is updated
     * @param base Address of the base token
     * @param quote Address of the quote token
     * @param maxDeviationBps Maximum allowed deviation between oracles (in basis points)
     */
    event MaxDeviationUpdated(address indexed base, address indexed quote, uint256 maxDeviationBps);

    // ────────────────────────────────────────────────
    // ░░  MODIFIERS
    // ────────────────────────────────────────────────

    /// @dev Restricts function execution to the contract owner
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /**
     * @notice Deploys the factory contract
     * @dev Sets the deployer as the immutable owner
     */
    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Deploys and initializes a MultiOracleAggregator for a given asset pair
     * @param base Address of the base token (e.g., ETH)
     * @param quote Address of the quote token (e.g., USDC)
     * @param oracles List of IPriceOracle-compatible addresses to register
     * @param maxDeviationBps Maximum allowed deviation between oracles (in basis points)
     * @return aggregator Address of the deployed MultiOracleAggregator
     * @custom:access Only callable by owner
     * @dev Reverts if an aggregator already exists for the pair
     */
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
        emit MaxDeviationUpdated(base, quote, maxDeviationBps);

        aggregators[base][quote] = address(agg);
        emit AggregatorCreated(base, quote, address(agg));
        return address(agg);
    }

    /**
     * @notice Removes an existing aggregator for a given pair
     * @param base Address of the base token
     * @param quote Address of the quote token
     * @custom:access Only callable by owner
     * @dev Reverts if no aggregator is found
     */
    function removeAggregator(address base, address quote) external onlyOwner {
        address aggregator = aggregators[base][quote];
        require(aggregator != address(0), "not found");
        delete aggregators[base][quote];
        emit AggregatorRemoved(base, quote);
    }

    /**
     * @notice Transfers the ownership of an aggregator to a new address
     * @param base Address of the base token
     * @param quote Address of the quote token
     * @param newOwner New owner address
     * @custom:access Only callable by owner
     * @dev Reverts if no aggregator is found or if the new owner is zero
     */
    function transferAggregatorOwnership(address base, address quote, address newOwner) external onlyOwner {
        address aggregator = aggregators[base][quote];
        require(aggregator != address(0), "not found");
        require(newOwner != address(0), "zero address");

        MultiOracleAggregator(aggregator).transferOwnership(newOwner);
        emit AggregatorOwnershipTransferred(base, quote, newOwner);
    }

    /**
     * @notice Returns the address of the aggregator for a given asset pair
     * @param base Address of the base token
     * @param quote Address of the quote token
     * @return Address of the registered aggregator, or zero if none exists
     */
    function getAggregator(address base, address quote) external view returns (address) {
        return aggregators[base][quote];
    }
}
