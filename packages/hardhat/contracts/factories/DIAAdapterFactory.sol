// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { DIAOracleAdapter } from "../oracles/DIAOracleAdapter.sol";
import { IOracleAggregator } from "../interfaces/IOracleAggregator.sol";

/**
 * @title DIAAdapterFactory
 * @author blocketh
 * @notice Factory contract to deploy DIAOracleAdapter instances and register them with an oracle aggregator.
 * @dev Each deployed adapter is preconfigured with a specific DIA key and registered with the provided aggregator.
 */
contract DIAAdapterFactory {
    /// @notice Address of the oracle aggregator that supports `addOracle`
    address public immutable aggregator;

    /// @notice Address of the DIA oracle contract (IDIAOracleV2)
    address public immutable dia;

    /// @notice Owner address with permission to deploy adapters
    address public immutable owner;

    /**
     * @notice Emitted when a new DIAOracleAdapter is deployed and registered
     * @param adapter Address of the newly deployed adapter
     * @param base Address of the base token
     * @param quote Address of the quote token
     * @param key DIA key identifier used for price lookup (e.g. "ETH/USD")
     */
    event AdapterCreated(address indexed adapter, address indexed base, address indexed quote, string key);

    /// @notice Restricts function access to the contract owner
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /**
     * @notice Deploys the factory and binds it to a DIA oracle and an oracle aggregator
     * @param _aggregator Address of the aggregator contract that implements `addOracle`
     * @param _diaOracle Address of the DIA oracle contract
     */
    constructor(address _aggregator, address _diaOracle) {
        aggregator = _aggregator;
        dia = _diaOracle;
        owner = msg.sender;
    }

    /**
     * @notice Deploys a new DIAOracleAdapter for a specific base/quote pair and key, and registers it
     * @dev Only callable by the contract owner. Registers the adapter in the aggregator automatically.
     * @param base Address of the base token (e.g. ETH)
     * @param quote Address of the quote token (e.g. USDC)
     * @param key DIA feed key string (e.g. "ETH/USD")
     * @return Address of the newly deployed DIAOracleAdapter
     */
    function deployAdapter(address base, address quote, string calldata key) external onlyOwner returns (address) {
        DIAOracleAdapter adapter = new DIAOracleAdapter(dia);
        adapter.setPairKey(base, quote, key);

        IOracleAggregator(aggregator).addOracle(base, quote, address(adapter));

        emit AdapterCreated(address(adapter), base, quote, key);
        return address(adapter);
    }
}
