pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/IForwarder.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "./lib/ArrayUtils.sol";

// TODO: Use SafeMath
contract Lock is AragonApp, IForwarder {

    using ArrayUtils for uint256;

    bytes32 constant public CHANGE_DURATION_ROLE = keccak256("CHANGE_DURATION_ROLE");
    bytes32 constant public CHANGE_AMOUNT_ROLE = keccak256("CHANGE_AMOUNT_ROLE");

    string private constant ERROR_TOO_MANY_UNLOCK_TIMES = "LOCK_TOO_MANY_UNLOCK_TIMES";
    string private constant ERROR_WITHIN_LOCK_DURATION = "LOCK_WITHIN_LOCK_DURATION";
    string private constant ERROR_CAN_NOT_FORWARD = "VOTING_CAN_NOT_FORWARD";

    event ChangeLockDuration(uint256 newLockDuration);
    event ChangeLockAmount(uint256 newLockAmount);

    ERC20 token;
    uint256 lockDuration;
    uint256 lockAmount;

    struct WithdrawLock {
        uint256 unlockTime;
        uint256 lockAmount;
    }

    // When needing an array of structs where the struct might be modified in a contract upgrade, it's better to use a
    // mapping instead of an array. Updates to a struct referenced in an array could overwrite other structs in that
    // array, where as updates to a struct referenced in a mapping would not overwrite other structs in that mapping.
    // This is because an array's data is stored contiguously in storage, where as a mapping's data is stored sparsely
    // in storage. In this case it means we can add to the WithdrawLock struct safely in a contract upgrade.
    struct WithdrawLocks {
        uint256 latestWithdrawnId;
        uint256 newWithdrawLockId;
        mapping(uint256 => WithdrawLock) withdrawLocks;
    }

    mapping(address => WithdrawLocks) addressesWithdrawLocks;

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
        WithdrawLocks storage addressWithdrawLocks = addressesWithdrawLocks[msg.sender];
        uint256 maxNumberWithdrawLocks = addressWithdrawLocks.newWithdrawLockId - addressWithdrawLocks.latestWithdrawnId;
        withdrawTokens(maxNumberWithdrawLocks);
    }

    // The approach used uses a mapping of id's (equivalent to array indices) to WithdrawLocks. New WithdrawLocks
    // are added to the end of the mapping in forward(). The withdrawTokens() function iterates through the WithdrawLocks from
    // latestWithdrawnId and saves the latestWithdrawnId, before a WithdrawLock that cannot be withdrawn. However, it continues
    // iterating after a locked withdrawLock is found as the duration may have changed, meaning a withdrawLock later in
    // the mapping could be withdrawable before the currently locked one in the iteration. The numberWithdrawLocks argument
    // currently determines how many of the WithdrawLocks are searched, if there are many locked WithdrawLocks ahead of
    // an unlocked WithdrawLock, numberWithdrawLocks may need to be increased to withdraw unlocked WithdrawLocks.
    //
    // A clearer approach would likely be to use a WithdrawLock[] array, where the WithdrawLock includes the owner of the lock
    // and a mapping(address => uint256[]) representing mapping(userAddress => withdrawLockIds[]). We could copy the
    // withdrawLockIds[] array, iterate through it and delete the withdrawn WithdrawLocks from the original as it goes.
    function withdrawTokens(uint256 numberWithdrawLocks) public {
        WithdrawLocks storage addressWithdrawLocks = addressesWithdrawLocks[msg.sender];

        require(addressWithdrawLocks.latestWithdrawnId + numberWithdrawLocks < addressWithdrawLocks.newWithdrawLockId,
            ERROR_TOO_MANY_UNLOCK_TIMES);

        uint256 finalWithdrawLockId = addressWithdrawLocks.latestWithdrawnId + numberWithdrawLocks;
        uint256 amountOwed = 0;
        uint256 newLatestWithdrawnId = addressWithdrawLocks.latestWithdrawnId;
        bool lockedWithdrawLockFound = false;

        for (uint256 withdrawLockId = addressWithdrawLocks.latestWithdrawnId;
            withdrawLockId < finalWithdrawLockId; withdrawLockId++) {

            WithdrawLock storage withdrawLock = addressWithdrawLocks.withdrawLocks[withdrawLockId];

            if (now > withdrawLock.unlockTime) {
                amountOwed += withdrawLock.lockAmount;
                delete addressWithdrawLocks.withdrawLocks[withdrawLockId];

                if (!lockedWithdrawLockFound) {
                    newLatestWithdrawnId = withdrawLockId;
                }

            } else {
                lockedWithdrawLockFound = true;
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

        WithdrawLocks storage addressWithdrawLocks = addressesWithdrawLocks[msg.sender];

        addressWithdrawLocks.withdrawLocks[addressWithdrawLocks.newWithdrawLockId] = WithdrawLock(now + lockDuration, lockAmount);
        addressWithdrawLocks.newWithdrawLockId++;

        token.transferFrom(msg.sender, address(this), lockAmount);

        runScript(evmCallScript, new bytes(0), new address[](0));
    }
}
