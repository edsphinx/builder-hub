// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MultiOracleAggregator
 * @author blocketh
 * @notice Aggregates multiple oracle price feeds (Euler, DIA, etc.) and returns validated price quotes.
 *         - Supports both average and median quote calculation methods.
 *         - Owner can add, remove, or toggle oracles per asset pair.
 *         - Enforces a maximum deviation between quotes to filter outliers.
 * @dev Designed for modular integration with ERC-4337-based Paymasters or other on-chain consumers.
 *      All oracle adapters MUST return quote values scaled to 1e18.
 *      No normalization is performed in this contract.
 *      Mixing oracles with inconsistent decimal scales will produce incorrect results.
 *      Ensure all adapters (e.g. EulerOracleAdapter, ChainlinkOracleAdapter) conform to this requirement.
 */

import { IPriceOracle } from "../interfaces/IPriceOracle.sol";

contract MultiOracleAggregator {
    // ────────────────────────────────────────────────
    // ░░  DATA STRUCTURES
    // ────────────────────────────────────────────────

    struct OracleInfo {
        address oracle;
        bool enabled;
    }

    /// @notice Mapping of oracles by asset pair: base ⇒ quote ⇒ list
    mapping(address => mapping(address => OracleInfo[])) private _oracles;

    /// @notice Max deviation allowed from computed reference (in basis points, e.g. 500 = 5%)
    uint256 public maxDeviationBps = 500;

    /// @notice Owner of the contract with full admin rights
    address public owner;

    // ────────────────────────────────────────────────
    // ░░  EVENTS
    // ────────────────────────────────────────────────

    event OracleAdded(address indexed base, address indexed quote, address oracle);
    event OracleRemoved(address indexed base, address indexed quote, uint256 index);
    event OracleToggled(address indexed base, address indexed quote, uint256 index, bool enabled);
    event MaxDeviationUpdated(uint256 bps);

    // ────────────────────────────────────────────────
    // ░░  MODIFIERS
    // ────────────────────────────────────────────────

    /// @dev Restricts function to the contract owner
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // ────────────────────────────────────────────────
    // ░░  CONSTRUCTOR
    // ────────────────────────────────────────────────

    /**
     * @notice Deploys the aggregator and sets the owner
     */
    constructor() {
        owner = msg.sender;
    }

    // ────────────────────────────────────────────────
    // ░░  ADMIN FUNCTIONS
    // ────────────────────────────────────────────────

    /**
     * @notice Registers a new oracle for a base/quote pair
     * @param base Token being priced
     * @param quote Token used as reference
     * @param oracle Address of the oracle implementing IPriceOracle
     * @custom:security onlyOwner
     */
    function addOracle(address base, address quote, address oracle) external onlyOwner {
        _oracles[base][quote].push(OracleInfo({ oracle: oracle, enabled: true }));
        emit OracleAdded(base, quote, oracle);
    }

    /**
     * @notice Removes an oracle by index from a base/quote pair
     * @param base Token being priced
     * @param quote Token used as reference
     * @param index Index of oracle in array
     * @custom:security onlyOwner
     */
    function removeOracle(address base, address quote, uint256 index) external onlyOwner {
        OracleInfo[] storage list = _oracles[base][quote];
        require(index < list.length, "invalid index");
        emit OracleRemoved(base, quote, index);
        list[index] = list[list.length - 1];
        list.pop();
    }

    /**
     * @notice Enables or disables an oracle by index
     * @param base Token being priced
     * @param quote Token used as reference
     * @param index Index of oracle in array
     * @param enabled New enabled status
     * @custom:security onlyOwner
     */
    function toggleOracle(address base, address quote, uint256 index, bool enabled) external onlyOwner {
        OracleInfo[] storage list = _oracles[base][quote];
        require(index < list.length, "invalid index");
        list[index].enabled = enabled;
        emit OracleToggled(base, quote, index, enabled);
    }

    /**
     * @notice Sets the maximum deviation allowed from the reference value
     * @param bps Deviation in basis points (max 10000)
     * @custom:security onlyOwner
     */
    function setMaxDeviationBps(uint256 bps) external onlyOwner {
        require(bps <= 10_000, "bps too high");
        maxDeviationBps = bps;
        emit MaxDeviationUpdated(bps);
    }

    /**
     * @notice Transfers the ownership of the contract to a new address
     * @param newOwner New owner address
     * @custom:security onlyOwner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        require(newOwner != owner, "same owner");
        owner = newOwner;
    }

    // ────────────────────────────────────────────────
    // ░░  READ FUNCTIONS
    // ────────────────────────────────────────────────

    /**
     * @notice Returns the average quote after deviation filtering
     * @param inAmount Amount of base token
     * @param base Token being priced
     * @param quote Token used as unit
     * @return outAmount Quote in quote token units (average)
     * @dev Reverts if no valid oracles or if deviation threshold is violated
     *      Assumes all oracle adapters return values scaled to 1e18.
     */
    function getQuoteAverage(uint256 inAmount, address base, address quote) external view returns (uint256 outAmount) {
        OracleInfo[] storage list = _oracles[base][quote];
        uint256 len = list.length;
        require(len > 0, "no oracles");

        uint256[] memory quotes = new uint256[](len);
        uint256 active;

        for (uint256 i; i < len; i++) {
            if (!list[i].enabled) continue;
            try IPriceOracle(list[i].oracle).getQuote(inAmount, base, quote) returns (uint256 q) {
                require(q > 0, "zero quote");
                quotes[active++] = q;
            } catch {}
        }

        require(active > 0, "no data");

        uint256 sum;
        for (uint256 i; i < active; i++) sum += quotes[i];
        uint256 avg = sum / active;

        for (uint256 i; i < active; i++) {
            uint256 diff = quotes[i] > avg ? quotes[i] - avg : avg - quotes[i];
            require((diff * 10_000) / avg <= maxDeviationBps, "deviation too high");
        }

        return avg;
    }

    /**
     * @notice Returns the median quote after deviation filtering
     * @param inAmount Amount of base token
     * @param base Token being priced
     * @param quote Token used as unit
     * @return outAmount Quote in quote token units (median)
     * @dev Reverts if no valid oracles or if deviation threshold is violated
     *      Assumes all oracle adapters return values scaled to 1e18.
     */
    function getQuoteMedian(uint256 inAmount, address base, address quote) external view returns (uint256 outAmount) {
        OracleInfo[] storage list = _oracles[base][quote];
        uint256 len = list.length;
        require(len > 0, "no oracles");

        uint256[] memory quotes = new uint256[](len);
        uint256 active;

        for (uint256 i; i < len; i++) {
            if (!list[i].enabled) continue;
            try IPriceOracle(list[i].oracle).getQuote(inAmount, base, quote) returns (uint256 q) {
                require(q > 0, "zero quote");
                quotes[active++] = q;
            } catch {}
        }

        require(active > 0, "no data");

        uint256[] memory activeQuotes = new uint256[](active);
        for (uint256 i; i < active; i++) activeQuotes[i] = quotes[i];

        uint256 median = _median(activeQuotes);

        for (uint256 i; i < active; i++) {
            uint256 diff = quotes[i] > median ? quotes[i] - median : median - quotes[i];
            require((diff * 10_000) / median <= maxDeviationBps, "deviation too high");
        }

        return median;
    }

    /**
     * @notice Returns the number of registered oracles for a base/quote pair
     * @param base Base token
     * @param quote Quote token
     * @return count Number of oracles
     */
    function oracleCount(address base, address quote) external view returns (uint256 count) {
        return _oracles[base][quote].length;
    }

    /**
     * @dev Returns the median of an array (bubble sort used for small arrays).
     *      For large sets, this should be replaced by a more gas-efficient sort.
     * @param arr Array of values
     * @return median The median value in the array
     */
    function _median(uint256[] memory arr) internal pure returns (uint256 median) {
        uint256 n = arr.length;
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = i + 1; j < n; j++) {
                if (arr[j] < arr[i]) {
                    (arr[i], arr[j]) = (arr[j], arr[i]);
                }
            }
        }
        return arr[n / 2];
    }
}
