pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/IForwarder.sol";
import "@aragon/os/contracts/common/IForwarderFee.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "./lib/WithdrawLockLib.sol";


contract Lock is AragonApp, IForwarder, IForwarderFee {

    using SafeERC20 for ERC20;
    using SafeMath for uint256;
    using WithdrawLockLib for WithdrawLockLib.WithdrawLock[];

    bytes32 public constant CHANGE_DURATION_ROLE = keccak256("CHANGE_DURATION_ROLE");
    bytes32 public constant CHANGE_AMOUNT_ROLE = keccak256("CHANGE_AMOUNT_ROLE");

    string private constant ERROR_TOO_MANY_WITHDRAW_LOCKS = "LOCK_TOO_MANY_WITHDRAW_LOCKS";
    string private constant ERROR_CAN_NOT_FORWARD = "LOCK_CAN_NOT_FORWARD";
    string private constant ERROR_TRANSFER_REVERTED = "LOCK_TRANSFER_REVERTED";

    ERC20 public token;
    uint256 public lockDuration;
    uint256 public lockAmount;

    // Using an array of WithdrawLocks instead of a mapping here means we cannot add fields to the WithdrawLock
    // struct in an upgrade of this contract. If we want to be able to add to the WithdrawLock structure in
    // future we must use a mapping instead.
    mapping(address => WithdrawLockLib.WithdrawLock[]) public addressesWithdrawLocks;

    event ChangeLockDuration(uint256 newLockDuration);
    event ChangeLockAmount(uint256 newLockAmount);
    event Withdrawal(address withdrawalAddress ,uint256 withdrawalLockCount);

    /**
    * @notice Initialize the Lock app
    * @param _token The token which will be locked when forwarding actions
    * @param _lockDuration The duration tokens will be locked before being able to be withdrawn
    * @param _lockAmount The amount of the token that is locked for each forwarded action
    */
    function initialize(address _token, uint256 _lockDuration, uint256 _lockAmount) external onlyInit {
        token = ERC20(_token);
        lockDuration = _lockDuration;
        lockAmount = _lockAmount;

        initialized();
    }

    /**
    * @notice Change lock duration to `_lockDuration`
    * @param _lockDuration The new lock duration
    */
    function changeLockDuration(uint256 _lockDuration) external auth(CHANGE_DURATION_ROLE) {
        lockDuration = _lockDuration;
        emit ChangeLockDuration(lockDuration);
    }

    /**
    * @notice Change lock amount to `_lockAmount`
    * @param _lockAmount The new lock amount
    */
    function changeLockAmount(uint256 _lockAmount) external auth(CHANGE_AMOUNT_ROLE) {
        lockAmount = _lockAmount;
        emit ChangeLockAmount(lockAmount);
    }

    /**
    * @notice Withdraw all withdrawable tokens
    */
    function withdrawTokens() external {
        WithdrawLockLib.WithdrawLock[] storage addressWithdrawLocks = addressesWithdrawLocks[msg.sender];
        _withdrawTokens(msg.sender, addressWithdrawLocks.length);
    }

    /**
    * @notice Withdraw all withdrawable tokens from the `_numberWithdrawLocks` oldest withdraw lock's
    * @param _numberWithdrawLocks The number of withdraw locks to attempt withdrawal from
    */
    function withdrawTokens(uint256 _numberWithdrawLocks) external {
        _withdrawTokens(msg.sender, _numberWithdrawLocks);
    }

    /**
    * @notice Tells the forward fee token and amount of the Tollgate app
    * @dev IFeeForwarder interface conformance
    * @return Forwarder token address
    * @return Forwarder lock amount
    */
    function forwardFee() external view returns (address, uint256) {
        return (address(token), lockAmount);
    }

    /**
    * @notice Tells whether the Tollgate app is a forwarder or not
    * @dev IForwarder interface conformance
    * @return Always true
    */
    function isForwarder() external pure returns (bool) {
        return true;
    }

    /**
    * @notice Tells whether the _sender can forward actions or not
    * @dev IForwarder interface conformance. It assumes the sender can always forward actions through the Tollgate app.
    * @return True if contract is allowed to transfer at least lockAmount tokens from _sender to itself
    */
    function canForward(address, bytes) public view returns (bool) {
        // bool allowanceAvailable = token.allowance(_sender, address(this)) >= lockAmount;
        // return allowanceAvailable;
        return hasInitialized();
    }

    /**
    * @notice Locks the required amount of tokens and executes the specified action
    * @dev IForwarder interface conformance. Consider using pretransaction on UI for necessary approval.
    * @param _evmCallScript Script to execute
    */
    function forward(bytes _evmCallScript) public {
        require(canForward(msg.sender, _evmCallScript), ERROR_CAN_NOT_FORWARD);

        WithdrawLockLib.WithdrawLock[] storage addressWithdrawLocks = addressesWithdrawLocks[msg.sender];
        uint256 duration = getTimestamp().add(lockDuration);
        addressWithdrawLocks.push(WithdrawLockLib.WithdrawLock(duration, lockAmount));

        require(token.safeTransferFrom(msg.sender, address(this), lockAmount), ERROR_TRANSFER_REVERTED);

        runScript(_evmCallScript, new bytes(0), new address[](0));
    }

    function getWithdrawLocksCount(address _lockAddress) public view returns (uint256) {
        return addressesWithdrawLocks[_lockAddress].length;
    }

    function _withdrawTokens(address _sender, uint256 _numberWithdrawLocks) internal {
        WithdrawLockLib.WithdrawLock[] storage addressWithdrawLocksStorage = addressesWithdrawLocks[_sender];
        WithdrawLockLib.WithdrawLock[] memory addressWithdrawLocksCopy = addressesWithdrawLocks[_sender];

        require(_numberWithdrawLocks <= addressWithdrawLocksCopy.length, ERROR_TOO_MANY_WITHDRAW_LOCKS);

        uint256 amountOwed = 0;
        uint256 withdrawLockCount = 0;

        for (uint256 withdrawLockIndex = 0; withdrawLockIndex < _numberWithdrawLocks; withdrawLockIndex++) {

            WithdrawLockLib.WithdrawLock memory withdrawLock = addressWithdrawLocksCopy[withdrawLockIndex];

            if (getTimestamp() > withdrawLock.unlockTime) {
                amountOwed = amountOwed.add(withdrawLock.lockAmount);
                withdrawLockCount += 1;
                addressWithdrawLocksStorage.deleteItem(withdrawLock);
            }
        }
        token.transfer(_sender, amountOwed);

        emit Withdrawal(_sender, withdrawLockCount);
    }
}
