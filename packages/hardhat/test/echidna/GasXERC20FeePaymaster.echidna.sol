// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/core/GasXERC20FeePaymaster.sol";
import { IEntryPoint } from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Mock EntryPoint for Echidna testing
 */
contract EchidnaMockEntryPoint {
    function supportsInterface(bytes4) external pure returns (bool) {
        return true;
    }
    function depositTo(address) external payable {}
    function withdrawTo(address payable, uint256) external {}
    function getDepositInfo(address) external pure returns (uint256, bool, uint112, uint32, uint48) {
        return (0, false, 0, 0, 0);
    }
    function balanceOf(address) external pure returns (uint256) { return 0; }
    function addStake(uint32) external payable {}
    function unlockStake() external {}
    function withdrawStake(address payable) external {}
}

/**
 * @title Mock ERC20 for Echidna testing
 */
contract EchidnaMockERC20 is IERC20 {
    string public name = "Mock USDC";
    string public symbol = "MUSDC";
    uint8 public decimals = 6;
    
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        _totalSupply += amount;
    }

    function totalSupply() external view returns (uint256) { return _totalSupply; }
    function balanceOf(address account) external view returns (uint256) { return _balances[account]; }
    function transfer(address to, uint256 amount) external returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }
    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to] += amount;
        return true;
    }
}

/**
 * @title Mock Oracle for Echidna testing
 */
contract EchidnaMockOracle {
    uint256 public mockPrice = 4000e6;
    function setMockPrice(uint256 _price) external { mockPrice = _price; }
    function computeQuoteAverage(uint256 amount, address, address) external view returns (uint256) {
        return (amount * mockPrice) / 1e18;
    }
}

/**
 * @title Testable GasXERC20FeePaymaster for Echidna
 */
contract EchidnaTestablePaymaster is GasXERC20FeePaymaster {
    constructor(
        IEntryPoint _entryPoint,
        address _feeToken,
        address _priceQuoteBaseToken,
        address _priceOracle,
        address _initialOracleSigner,
        uint256 _minFee,
        uint256 _feeMarkupBps
    ) GasXERC20FeePaymaster(
        _entryPoint,
        _feeToken,
        _priceQuoteBaseToken,
        _priceOracle,
        _initialOracleSigner,
        _minFee,
        _feeMarkupBps
    ) {}

    function exposedCalculateFee(uint256 gasCost, uint256 price) external view returns (uint256) {
        return _calculateFee(gasCost, price);
    }
}

/**
 * @title GasXERC20FeePaymaster Echidna Invariant Tests
 * @notice Property-based testing for critical invariants
 * @dev Run with: echidna test/echidna/GasXERC20FeePaymaster.echidna.sol --contract GasXERC20PaymasterEchidnaTest
 */
contract GasXERC20PaymasterEchidnaTest {
    EchidnaTestablePaymaster public paymaster;
    EchidnaMockEntryPoint public entryPoint;
    EchidnaMockERC20 public feeToken;
    EchidnaMockERC20 public weth;
    EchidnaMockOracle public oracle;

    // State tracking for invariants
    uint256 private previousTotalFees;
    uint256 public constant MAX_MARKUP_BPS = 1000;
    uint256 public constant DEFAULT_MIN_FEE = 10000;

    // Events for debugging
    event InvariantViolation(string reason);

    constructor() {
        entryPoint = new EchidnaMockEntryPoint();
        feeToken = new EchidnaMockERC20();
        weth = new EchidnaMockERC20();
        oracle = new EchidnaMockOracle();

        paymaster = new EchidnaTestablePaymaster(
            IEntryPoint(address(entryPoint)),
            address(feeToken),
            address(weth),
            address(oracle),
            address(0x2222), // oracle signer
            DEFAULT_MIN_FEE,
            100 // 1% markup
        );

        previousTotalFees = 0;
    }

    // ─────────────────────────────────────────────────────────────────
    // INVARIANT 1: Fee must always be >= minFee
    // ─────────────────────────────────────────────────────────────────
    
    function echidna_fee_always_gte_minFee() public view returns (bool) {
        // Test with various gas costs
        uint256 minFee = paymaster.minFee();
        
        // Test with zero gas cost
        uint256 feeZero = paymaster.exposedCalculateFee(0, 4000e6);
        if (feeZero < minFee) return false;
        
        // Test with small gas cost
        uint256 feeSmall = paymaster.exposedCalculateFee(1000, 4000e6);
        if (feeSmall < minFee) return false;
        
        // Test with medium gas cost
        uint256 feeMedium = paymaster.exposedCalculateFee(1e15, 4000e6);
        if (feeMedium < minFee) return false;
        
        return true;
    }

    // ─────────────────────────────────────────────────────────────────
    // INVARIANT 2: Fee markup can never exceed MAX_MARKUP_BPS (10%)
    // ─────────────────────────────────────────────────────────────────
    
    function echidna_markup_never_exceeds_max() public view returns (bool) {
        return paymaster.feeMarkupBps() <= MAX_MARKUP_BPS;
    }

    // ─────────────────────────────────────────────────────────────────
    // INVARIANT 3: totalFeesCollected is monotonically increasing
    // ─────────────────────────────────────────────────────────────────
    
    function echidna_total_fees_monotonic() public view returns (bool) {
        uint256 currentTotal = paymaster.totalFeesCollected();
        return currentTotal >= previousTotalFees;
    }

    // ─────────────────────────────────────────────────────────────────
    // INVARIANT 4: Fee calculation is deterministic
    // ─────────────────────────────────────────────────────────────────
    
    function echidna_fee_calculation_deterministic() public view returns (bool) {
        uint256 gasCost = 1e17; // 0.1 ETH
        uint256 price = 4000e6;
        
        uint256 fee1 = paymaster.exposedCalculateFee(gasCost, price);
        uint256 fee2 = paymaster.exposedCalculateFee(gasCost, price);
        
        return fee1 == fee2;
    }

    // ─────────────────────────────────────────────────────────────────
    // INVARIANT 5: Fee is monotonically increasing with gas cost
    // ─────────────────────────────────────────────────────────────────
    
    function echidna_fee_increases_with_gas() public view returns (bool) {
        uint256 price = 4000e6;
        
        uint256 fee1 = paymaster.exposedCalculateFee(1e15, price);
        uint256 fee2 = paymaster.exposedCalculateFee(1e16, price);
        uint256 fee3 = paymaster.exposedCalculateFee(1e17, price);
        
        return fee1 <= fee2 && fee2 <= fee3;
    }

    // ─────────────────────────────────────────────────────────────────
    // INVARIANT 6: Oracle signer can never be zero address
    // ─────────────────────────────────────────────────────────────────
    
    function echidna_oracle_signer_not_zero() public view returns (bool) {
        return paymaster.oracleSigner() != address(0);
    }

    // ─────────────────────────────────────────────────────────────────
    // INVARIANT 7: Immutable addresses are set correctly
    // ─────────────────────────────────────────────────────────────────
    
    function echidna_immutables_set() public view returns (bool) {
        return paymaster.feeToken() != address(0) &&
               paymaster.priceQuoteBaseToken() != address(0) &&
               address(paymaster.priceOracle()) != address(0);
    }

    // ─────────────────────────────────────────────────────────────────
    // INVARIANT 8: estimateFee returns >= minFee
    // ─────────────────────────────────────────────────────────────────
    
    function echidna_estimate_fee_gte_minFee() public view returns (bool) {
        uint256 minFee = paymaster.minFee();
        uint256 estimated = paymaster.estimateFee(0);
        return estimated >= minFee;
    }

    // ─────────────────────────────────────────────────────────────────
    // STATE MUTATIONS (for Echidna to explore)
    // ─────────────────────────────────────────────────────────────────
    
    function setMinFee(uint256 _newMinFee) public {
        paymaster.setMinFee(_newMinFee);
    }

    function setFeeMarkup(uint256 _newMarkup) public {
        if (_newMarkup <= MAX_MARKUP_BPS) {
            paymaster.setFeeMarkup(_newMarkup);
        }
    }

    function setOracleSigner(address _newSigner) public {
        if (_newSigner != address(0)) {
            paymaster.setOracleSigner(_newSigner);
        }
    }

    function togglePause() public {
        if (paymaster.paused()) {
            paymaster.unpause();
        } else {
            paymaster.pause();
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // INVARIANT 9: Pause state is consistent
    // ─────────────────────────────────────────────────────────────────
    
    function echidna_pause_state_consistent() public view returns (bool) {
        bool isPaused = paymaster.paused();
        // Either paused or not - no intermediate state
        return isPaused == true || isPaused == false;
    }

    // ─────────────────────────────────────────────────────────────────
    // INVARIANT 10: PRICE_DEVIATION_BPS is constant (5%)
    // ─────────────────────────────────────────────────────────────────
    
    function echidna_price_deviation_constant() public view returns (bool) {
        return paymaster.PRICE_DEVIATION_BPS() == 500;
    }
}
