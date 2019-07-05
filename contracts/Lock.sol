pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/IForwarder.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "./lib/WithdrawLockLib.sol";

// TODO: Use SafeMath
contract Lock is AragonApp, IForwarder {

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

    // Using an array instead of a mapping here means we cannot add fields to the WithdrawLock struct in
    // an upgrade of this contract. If we want to be able to add to the WithdrawLock structure in future we must
    // use a mapping instead.
    mapping(address => WithdrawLockLib.WithdrawLock[]) addressesWithdrawLocks;

    function initialize(address _token, uint256 _lockDuration, uint256 _lockAmount) public onlyInit {
        token = ERC20(_token);
        lockDuration = _lockDuration;
        lockAmount = _lockAmount;

        initialized();
    }

    function changeLockDuration(uint256 _lockDuration) public auth(CHANGE_DURATION_ROLE) {
        lockDuration = _lockDuration;
        emit ChangeLockDuration(lockDuration);
    }

    function changeLockAmount(uint256 _lockAmount) public auth(CHANGE_AMOUNT_ROLE) {
        lockAmount = _lockAmount;
        emit ChangeLockAmount(lockAmount);
    }

    function withdrawTokens() public {
        WithdrawLockLib.WithdrawLock[] storage addressWithdrawLocks = addressesWithdrawLocks[msg.sender];
        withdrawTokens(addressWithdrawLocks.length);
    }

    function withdrawTokens(uint256 numberWithdrawLocks) public {
        WithdrawLockLib.WithdrawLock[] storage addressWithdrawLocksStorage = addressesWithdrawLocks[msg.sender];
        WithdrawLockLib.WithdrawLock[] memory addressWithdrawLocksCopy = addressesWithdrawLocks[msg.sender];

        require(numberWithdrawLocks <= addressWithdrawLocksCopy.length, ERROR_TOO_MANY_WITHDRAW_LOCKS);

        uint256 amountOwed = 0;

        for (uint256 withdrawLockIndex = 0; withdrawLockIndex < numberWithdrawLocks; withdrawLockIndex++) {

            WithdrawLockLib.WithdrawLock memory withdrawLock = addressWithdrawLocksCopy[withdrawLockIndex];

            if (now > withdrawLock.unlockTime) {
                amountOwed += withdrawLock.lockAmount;
                addressWithdrawLocksStorage.deleteItem(withdrawLock);
            }
        }

        token.transfer(msg.sender, amountOwed);
    }

    function isForwarder() external pure returns (bool) {
        return true;
    }

    function canForward(address sender, bytes evmCallScript) public view returns (bool) {
        bool allowanceAvailable = token.allowance(msg.sender, address(this)) >= lockAmount;
        return allowanceAvailable;
    }

    // This requires approve be called before. Consider using an approve pretransaction in the aragonApi, prompting
    // the user to execute 2 transactions in sequence.
    function forward(bytes evmCallScript) public {
        require(canForward(msg.sender, evmCallScript), ERROR_CAN_NOT_FORWARD);

        WithdrawLockLib.WithdrawLock[] storage addressWithdrawLocks = addressesWithdrawLocks[msg.sender];
        addressWithdrawLocks.push(WithdrawLockLib.WithdrawLock(now + lockDuration, lockAmount));

        token.transferFrom(msg.sender, address(this), lockAmount);

        runScript(evmCallScript, new bytes(0), new address[](0));
    }
}
