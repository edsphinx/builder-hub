// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EulerOracleAdapter
 * @author edsphinx
 * @notice Adapter to convert token prices using the Euler on-chain oracle.
 *         Implements the IPriceOracle interface expected by aggregators like MultiOracleAggregator.
 *         - Uses Euler’s getPrice(base, quote) with 1e18 precision.
 *         - Converts any inAmount of base into equivalent quote amount.
 * @dev Safe against overflows via mulDiv. Reverts if price is zero or source is invalid.
 */

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";

/// @notice Interface for Euler's price oracle
interface IEulerOracle {
    /**
     * @notice Returns the price of `base` denominated in `quote` token units
     * @param base Token being priced
     * @param quote Token used as denominator
     * @return price Scaled price (1e18 precision)
     */
    function getPrice(address base, address quote) external view returns (uint256 price);
}

/**
 * @notice Adapter that wraps a deployed Euler oracle into a standard IPriceOracle interface
 * @dev Fixed scale of 1e18. Reverts if price is zero. Uses full-precision mulDiv for safety.
 */
contract EulerOracleAdapter is IPriceOracle {
    /// @notice Address of the underlying Euler oracle contract
    IEulerOracle public immutable euler;

    address public immutable base;
    address public immutable quote;

    /**
     * @param _euler Address of the deployed Euler oracle
     */
    constructor(address _euler, address _base, address _quote) {
        require(_euler.code.length > 0, "euler: not contract");
        euler = IEulerOracle(_euler);
        base = _base;
        quote = _quote;
    }

    /**
     * @inheritdoc IPriceOracle
     * @notice Converts an amount of `base` token into `quote` token units using Euler price feed.
     * @param inAmount Amount of base token to convert
     * @param _base Address of token being priced
     * @param _quote Address of token used as unit of value
     * @return outAmount Converted output value in quote tokens (scaled to 1e18)
     */
    function getQuote(
        uint256 inAmount,
        address _base,
        address _quote
    ) external view override returns (uint256 outAmount) {
        require(base == _base && quote == _quote, "invalid pair");
        uint256 price = euler.getPrice(base, quote);
        require(price > 0, "euler: zero price");
        outAmount = Math.mulDiv(inAmount, price, 1e18);
    }
}
