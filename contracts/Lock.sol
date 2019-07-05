pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/IForwarder.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "./lib/WithdrawLockLib.sol";

contract Lock is AragonApp, IForwarder {

    using SafeMath for uint256;
    using WithdrawLockLib for WithdrawLockLib.WithdrawLock[];

    bytes32 constant public CHANGE_DURATION_ROLE = keccak256("CHANGE_DURATION_ROLE");
    bytes32 constant public CHANGE_AMOUNT_ROLE = keccak256("CHANGE_AMOUNT_ROLE");

    string private constant ERROR_TOO_MANY_WITHDRAW_LOCKS = "LOCK_TOO_MANY_WITHDRAW_LOCKS";
    string private constant ERROR_CAN_NOT_FORWARD = "LOCK_CAN_NOT_FORWARD";

    event ChangeLockDuration(uint256 newLockDuration);
    event ChangeLockAmount(uint256 newLockAmount);

    ERC20 token;
    uint256 lockDuration;
    uint256 lockAmount;

    // Using an array of WithdrawLocks instead of a mapping here means we cannot add fields to the WithdrawLock
    // struct in an upgrade of this contract. If we want to be able to add to the WithdrawLock structure in
    // future we must use a mapping instead.
    mapping(address => WithdrawLockLib.WithdrawLock[]) addressesWithdrawLocks;

    /**
    * @notice Initialize the Lock app
    * @param _token The token which will be locked when forwarding actions
    * @param _lockDuration The duration tokens will be locked before being able to be withdrawn
    * @param _lockAmount The amount of the token that is locked for each forwarded action
    */
    function initialize(address _token, uint256 _lockDuration, uint256 _lockAmount) public onlyInit {
        token = ERC20(_token);
        lockDuration = _lockDuration;
        lockAmount = _lockAmount;

        initialized();
    }

    /**
    * @notice Change lock duration to `_lockDuration`
    * @param _lockDuration The new lock duration
    */
    function changeLockDuration(uint256 _lockDuration) public auth(CHANGE_DURATION_ROLE) {
        lockDuration = _lockDuration;
        emit ChangeLockDuration(lockDuration);
    }

    /**
    * @notice Change lock amount to `_lockAmount`
    * @param _lockAmount The new lock amount
    */
    function changeLockAmount(uint256 _lockAmount) public auth(CHANGE_AMOUNT_ROLE) {
        lockAmount = _lockAmount;
        emit ChangeLockAmount(lockAmount);
    }

    /**
    * @notice Withdraw all withdrawable tokens
    */
    function withdrawTokens() public {
        WithdrawLockLib.WithdrawLock[] storage addressWithdrawLocks = addressesWithdrawLocks[msg.sender];
        withdrawTokens(addressWithdrawLocks.length);
    }

    /**
    * @notice Attempt to withdraw tokens from `numberWithdrawLocks` withdraw lock's
    * @param _numberWithdrawLocks The number of withdraw locks to attempt withdrawal from
    */
    function withdrawTokens(uint256 _numberWithdrawLocks) public {
        WithdrawLockLib.WithdrawLock[] storage addressWithdrawLocksStorage = addressesWithdrawLocks[msg.sender];
        WithdrawLockLib.WithdrawLock[] memory addressWithdrawLocksCopy = addressesWithdrawLocks[msg.sender];

        require(_numberWithdrawLocks <= addressWithdrawLocksCopy.length, ERROR_TOO_MANY_WITHDRAW_LOCKS);

        uint256 amountOwed = 0;

        for (uint256 withdrawLockIndex = 0; withdrawLockIndex < _numberWithdrawLocks; withdrawLockIndex++) {

            WithdrawLockLib.WithdrawLock memory withdrawLock = addressWithdrawLocksCopy[withdrawLockIndex];

            if (now > withdrawLock.unlockTime) {
                amountOwed = amountOwed.add(withdrawLock.lockAmount);
                addressWithdrawLocksStorage.deleteItem(withdrawLock);
            }
        }

        token.transfer(msg.sender, amountOwed);
    }

    function isForwarder() external pure returns (bool) {
        return true;
    }

    function canForward(address _sender, bytes _evmCallScript) public view returns (bool) {
        bool allowanceAvailable = token.allowance(_sender, address(this)) >= lockAmount;
        return allowanceAvailable;
    }

    /**
    * @notice Locks the required amount of tokens and executes the specified action
    * @dev IForwarder interface conformance. Consider using pretransaction on UI for necessary approval.
    * @param _evmCallScript Script to execute
    */
    function forward(bytes _evmCallScript) public {
        require(canForward(msg.sender, _evmCallScript), ERROR_CAN_NOT_FORWARD);

        WithdrawLockLib.WithdrawLock[] storage addressWithdrawLocks = addressesWithdrawLocks[msg.sender];
        addressWithdrawLocks.push(WithdrawLockLib.WithdrawLock(now.add(lockDuration), lockAmount));

        token.transferFrom(msg.sender, address(this), lockAmount);

        runScript(_evmCallScript, new bytes(0), new address[](0));
    }
}
