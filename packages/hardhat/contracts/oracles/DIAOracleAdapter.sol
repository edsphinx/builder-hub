// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPriceOracle } from "../interfaces/IPriceOracle.sol";
import { IDIAOracleV2 } from "../interfaces/IDIAOracleV2.sol";

/**
 * @title DIAOracleAdapter
 * @author edsphinx
 * @notice Adapter to consume DIA oracle feeds and expose them in IPriceOracle format.
 * @dev Designed for integration with MultiOracleAggregator.
 *      Assumes DIA price values are returned with 8 decimals.
 *      Validates that the price is non-zero and not older than 1 hour.
 */
contract DIAOracleAdapter is IPriceOracle {
    /// @notice DIA oracle contract reference
    IDIAOracleV2 public immutable dia;

    /// @notice Contract owner with permission to set pair keys
    address public immutable owner;

    /**
     * @notice Mapping of token pairs to DIA key identifiers
     * @dev Maps (base, quote) token addresses to the corresponding DIA price feed key
     */
    mapping(address => mapping(address => string)) public pairKeys;

    /// @notice Restricts access to owner-only functions
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /**
     * @notice Deploys the DIAOracleAdapter
     * @param _diaOracle Address of the DIA oracle contract
     */
    constructor(address _diaOracle, address _base, address _quote, string memory _key) {
        dia = IDIAOracleV2(_diaOracle);
        owner = msg.sender;
        pairKeys[_base][_quote] = _key;
    }

    /**
     * @notice Sets the DIA price feed key for a given token pair
     * @dev Only callable by the contract owner
     * @param base Address of the base token
     * @param quote Address of the quote token
     * @param key Key used to fetch the price from DIA oracle (e.g., "ETH/USD")
     */
    function setPairKey(address base, address quote, string memory key) external onlyOwner {
        pairKeys[base][quote] = key;
    }

    /**
     * @inheritdoc IPriceOracle
     * @notice Returns a price quote from DIA based on the provided base/quote pair and amount
     * @dev Reverts if the pair key is unset, price is zero, or data is stale (>1h).
     *      DIA prices are expected to be in 8 decimals, while inAmount is assumed to be 18 decimals.
     * @param inAmount Input amount in base token units (1e18)
     * @param base Address of the base token
     * @param quote Address of the quote token
     * @return outAmount Equivalent amount in quote token units (1e18)
     */
    function getQuote(
        uint256 inAmount,
        address base,
        address quote
    ) external view override returns (uint256 outAmount) {
        string memory key = pairKeys[base][quote];
        require(bytes(key).length > 0, "DIA: pair not set");

        (uint128 price, uint128 ts) = dia.getValue(key);
        require(price > 0, "DIA: zero price");
        require(block.timestamp - ts < 1 hours, "DIA: stale");

        outAmount = (uint256(price) * inAmount) / 1e8;
    }
}
