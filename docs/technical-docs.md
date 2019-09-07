
<br />

## WithdrawLockLib.sol

`WithdrawLockLib.sol` is a library that creates and deletes locks. Because `Lock.sol` is dependent on many Aragon apps that use solidity 0.4.24, `WithdrawLockLib.sol` also uses solidity 0.4.24. In the future these may be upgraded.
```
pragma solidity ^0.4.24;
```
```
pragma solidity ^0.4.24;

library WithdrawLockLib {
	// snip
}
```

### Creating Locks

Locks are encoded in a `WithdrawLock` struct that keeps track of the `unlockTime` (when the lock can be unlocked) and `lockAmount` (how many tokens were locked).
```
struct WithdrawLock {
		uint256 unlockTime;
		uint256 lockAmount;
}
```

### Deleting Locks

The `deleteItem()`	function takes in a `WithdrawLock` struct, checks that it matches a lock associated with the address that's calling it, and then deletes the lock and decreases the lock counter for that address by 1. Then it returns a boolean if it succeeded or not. This then lets `_withdrawTokens()` know if it should transfer the `WithdrawLock` amount to the user or not.
```
function deleteItem(WithdrawLock[] storage self, WithdrawLock item) internal returns (bool) {
		uint256 length = self.length;
		for (uint256 i = 0; i < length; i++) {
				if (self[i].unlockTime == item.unlockTime && self[i].lockAmount == item.lockAmount) {
						uint256 newLength = self.length - 1;
						if (i != newLength) {
								self[i] = self[newLength];
						}

						delete self[newLength];
						self.length = newLength;

						return true;
				}
		}
}
```

### QUESTIONS
- What's the difference between `WithdrawLock[]` and `WithdrawLock item` ?
- Do we assume that the longest lock in the array is the oldest, thus we delete it?

<br />

## Lock.sol

`Lock.sol` is an Aragon [forwarder](https://hack.aragon.org/docs/forwarding-intro). By granting the lock app a permission like `Create Votes` the user will be prompted and required to lock tokens before the user's intent can be forwarded.

### Solidity Version

`Lock.sol` is dependent on many Aragon apps that use solidity 0.4.24. In the future these may be upgraded.
```
pragma solidity ^0.4.24;
```

### Dependencies

Our dependencies are fairly straight forward. We do however create an external library `WithdrawLockLib.sol` to manage the storage of a user's locks and their duration. More info on that can be seen in the `WithdrawLockLib.sol` section of this guide.
```

// pre audited contracts
import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/IForwarder.sol";
import "@aragon/os/contracts/common/IForwarderFee.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
// library we created
import "./lib/WithdrawLockLib.sol";
```

### Global Variables
```
// the type of token to be locked
// - in the future this may include ETH as well as ERC20 tokens
ERC20 public token;
// the amount of time to lock the token
uint256 public lockDuration;
// the aount of that token to be locked
uint256 public lockAmount;
// a multiplier that increases the amount and time locked depending on how many locks you already have (spam deterent)
uint256 public griefingFactor;
// the griefingFactor is multiplied by `WHOLE_GRIEFING` to create a fractional griefingFactor
// example: the app's standard `lockDuration` multiplied by the user's active locks multiplied by the `griefingFactor` on this lock, all divided by WHOLE_GRIEFING to either create a multiplier or fractional percentage of the standard `lockDuration`
uint256 private constant WHOLE_GRIEFING = 100;
```

### Mapping Addresses to Locks
```
// Using an array of WithdrawLocks instead of a mapping here means we cannot add fields to the WithdrawLock struct in an upgrade of this contract. If we want to be able to add to the WithdrawLock structure in future we must use a mapping instead.
mapping(address => WithdrawLockLib.WithdrawLock[]) public addressesWithdrawLocks;
```

### Emitting Events
```
event ChangeLockDuration(uint256 newLockDuration);
event ChangeLockAmount(uint256 newLockAmount);
event NewLock(address lockAddress, uint256 unlockTime, uint256 lockAmount);
event Withdrawal(address withdrawalAddress ,uint256 withdrawalLockCount);
```

### Initializing The Lock App
```
/**
* @notice Initialize the Lock app
* @param _token The token which will be locked when forwarding actions
* @param _lockDuration The duration tokens will be locked before being able to be withdrawn
* @param _lockAmount The amount of the token that is locked for each forwarded action
* @param _griefingFactor The griefing pct will be calculated as `griefingFactor / WHOLE_GRIEFING`
*/
function initialize(address _token, uint256 _lockDuration, uint256 _lockAmount, uint256 _griefingFactor) external onlyInit {
		token = ERC20(_token);
		lockDuration = _lockDuration;
		lockAmount = _lockAmount;
		griefingFactor = _griefingFactor;

		initialized();
}
```

### Changing Global Parameters

These functions allow changes to to the standard parameters for the lock app. We anticipate the `CHANGE_DURATION_ROLE`, `CHANGE_AMOUNT_ROLE`, and `CHANGE_GRIEFING_ROLE` to be set to the `Voting` app or to an administrative member of the DAO.
```
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
* @notice Change griefing factor to `_griefingFactor`
* @param _griefingFactor The new griefing factor
*/
function changeGriefingFactor(uint256 _griefingFactor) external auth(CHANGE_GRIEFING_ROLE) {
		griefingFactor = _griefingFactor;
		emit ChangeLockAmount(griefingFactor);
}
```

### Withdrawing Locks
QUESTION
What is the difference between the `withdrawTokens()` function and the `withdrawTokens(uint256 _numberWithdrawLocks)` function? Do they both allow an address to request a lock withdrawal, but one allows the callers to specify how many locks and the other just tries to withdraw all the locks?
```
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
```

### Forwarding Intent

`forwardFee()` returns the amount that a user must lock in order to forward an intent. While this function is unopinionated as to what that intent is, in the context of Dandelion Orgs we expect this to be a proposal for the group to vote on.
```
/**
* @notice Tells the forward fee token and amount of the Lock app
* @dev IFeeForwarder interface conformance
*      Note that the Lock app has to be the first forwarder in the transaction path, it must be called by an EOA not another forwarder, in order for the griefing mechanism to work
* @return Forwarder token address
* @return Forwarder lock amount
*/
function forwardFee() external view returns (address, uint256) {
		(uint256 _griefAmount, ) = getGriefing(msg.sender);

		uint256 totalLockAmountRequired = lockAmount.add(_griefAmount);

		return (address(token), totalLockAmountRequired);
}
```

`isForwarder()` ensures that the lock app can forward intents
```
/**
* @notice Tells whether the Lock app is a forwarder or not
* @dev IForwarder interface conformance
* @return Always true
*/
function isForwarder() external pure returns (bool) {
		return true;
}
```

`canForward()` checks if the `msg.sender` can forward an intent. This permission can be set to any app, but in the Dandelion Org Template we set it to a Token Manager Oracle that checks with the Token Manager app to make sure that the address that is trying to forward an intent is also a DAO token holder
```
/**
* @notice Tells whether the _sender can forward actions or not
* @dev IForwarder interface conformance
* @return True if _sender has LOCK_TOKENS_ROLE role
*/
function canForward(address _sender, bytes) public view returns (bool) {
		return canPerform(_sender, LOCK_TOKENS_ROLE, arr());
}
```

`forward()` checks the amount that a user has to lock to forward an intent, gets that amount from the user and creates the lock, then forwards the intent
```
/**
* @notice Locks the required amount of tokens and executes the specified action
* @dev IForwarder interface conformance. Consider using pretransaction on UI for necessary approval.
*      Note that the Lock app has to be the first forwarder in the transaction path, it must be called by an EOA not another forwarder, in order for the griefing mechanism to work
* @param _evmCallScript Script to execute
*/
function forward(bytes _evmCallScript) public {
		require(canForward(msg.sender, _evmCallScript), ERROR_CAN_NOT_FORWARD);

		(uint256 griefAmount, uint256 griefDuration) = getGriefing(msg.sender);

		uint256 totalAmount = lockAmount.add(griefAmount);
		uint256 totalDuration = lockDuration.add(griefDuration);

		WithdrawLockLib.WithdrawLock[] storage addressWithdrawLocks = addressesWithdrawLocks[msg.sender];
		uint256 unlockTime = getTimestamp().add(totalDuration);
		addressWithdrawLocks.push(WithdrawLockLib.WithdrawLock(unlockTime, totalAmount));

		require(token.safeTransferFrom(msg.sender, address(this), totalAmount), ERROR_TRANSFER_REVERTED);

		emit NewLock(msg.sender, unlockTime, totalAmount);
		runScript(_evmCallScript, new bytes(0), new address[](0));
}
```

### Getters

`getWithdrawLocksCount()` returns the amount of locks a user has
```
function getWithdrawLocksCount(address _lockAddress) public view returns (uint256) {
		return addressesWithdrawLocks[_lockAddress].length;
}
```

`getGriefing()` calculates the number of active locks an address has
```
/**
* @notice Get's amount and duration penalty based on the number of current locks `_sender` has
* @param _sender account that is going to lock tokens
* @return amount penalty
* @return duration penalty
*/
function getGriefing(address _sender) public view returns (uint256, uint256) {
		WithdrawLockLib.WithdrawLock[] memory addressWithdrawLocks = addressesWithdrawLocks[_sender];

		uint256 activeLocks = 0;
		for (uint256 withdrawLockIndex = 0; withdrawLockIndex < addressWithdrawLocks.length; withdrawLockIndex++) {
				if (getTimestamp() < addressWithdrawLocks[withdrawLockIndex].unlockTime) {
						activeLocks += 1;
				}
		}

		return (lockAmount.mul(activeLocks).mul(griefingFactor).div(WHOLE_GRIEFING), lockDuration.mul(activeLocks).mul(griefingFactor).div(WHOLE_GRIEFING));
}
```

### Withdrawing Locked Tokens

`withdrawTokens()` is a user facing function that allows DAO members to withdraw their previously locked tokens
```
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
```
}
