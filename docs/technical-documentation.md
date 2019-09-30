# Time Lock App Technical Docs

This doc goes through `Lock.sol` and `WithdrawLockLib.sol`, explaining every function and it's intended functionality.

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

The `deleteItem()` function takes in a `WithdrawLock` struct, checks that it matches a lock associated with the address that's calling it, and then deletes the lock and decreases the lock counter for that address by 1. Then it returns a boolean if it succeeded or not. This then lets `_withdrawTokens()` know if it should transfer the `WithdrawLock` amount to the user or not.

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

<br />

## Lock.sol

`Lock.sol` is an Aragon [forwarder](https://hack.aragon.org/docs/forwarding-intro). By granting the time lock app a permission like `Create Votes` the user will be prompted and required to lock tokens before the user's intent can be forwarded.

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
// library we created to manage locks
import "./lib/WithdrawLockLib.sol";
```

### Global Variables

```
// the type of token to be locked
// - in the future this may include ETH as well as ERC20 tokens
ERC20 public token;
// the amount of time to lock the token
uint256 public lockDuration;
// the amount of that token to be locked
uint256 public lockAmount;
// a multiplier that increases the amount and time locked depending on how many locks you already have (spam deterent)
uint256 public spamPenaltyFactor;
// the spamPenaltyFactor is divided by `PCT_BASE` to create a fractional percentage
// example: the app's standard `lockDuration` multiplied by the user's active locks multiplied by the `spamPenaltyFactor` on this lock, all divided by PCT_BASE to either create a multiplier or fractional percentage of the standard `lockDuration`
// - note: since this is a constant it can be set here rather than in the `initialize()` function
// The spam penalty value is expressed between zero and a maximum of 10^18 (that represents 100%). As a consequence, it's important to consider that 1% is actually represented by 10^16.
uint256 public constant PCT_BASE = 10 ** 18;
```

### Spam penalty Variables Explained

The spam penalty calculation does not reflect how many tokens should be locked and for how long, but rather the amount and duration to add to the base lockAmount and lockDuration. The `spamPenaltyFactor` is a % of the base lock amount and duration values set on the app. This value increases the more locks an account has, making it more and more expensive to create many locks.

When an account wants to submit a proposal they will have to lock `lockAmount` + (`lockAmount` _ `totalActiveLocks` _ `spamPenaltyFactor`/ `PCT_BASE`) for a duration of `lockDuration` + (`lockDuration` _ `totalActiveLocks` _ `spamPenaltyFactor` / `PCT_BASE`)

e.g. if the `lockAmount` = 20 tokens, `lockDuration` = 6 days and `spamPenaltyFactor` is 50%, and the account submitting a proposal has 2 active locks, they will have to lock 40 tokens for 12 days.

The idea behind this is to prevent spamming of proposals.

> Note: this only works if permissions on the lock-app are set so that only members of the DAO `canForward()`. If _anyone_ can submit proposals or DAO members can easily transfer their membership tokens between accounts the spam penalty mechanism is much less effective.

### Mapping Addresses to Locks

`addressesWithdawLocks` maps an address to it's locks. Since an address can have multiple locks, these locks are stored in a `WithdrawLock[]` dynamically sized array. Each lock is a `WithdrawLock` struct that has an `unlockAmount` and `unlockTime`. Each address is mapped to a `WithdrawLock[]` array that holds that address's `WithdrawLock` stucts.

```
// Using an array of WithdrawLocks instead of a mapping here means we cannot add fields to the WithdrawLock struct in an upgrade of this contract. If we want to be able to add to the WithdrawLock structure in future we must use a mapping instead.
mapping(address => WithdrawLockLib.WithdrawLock[]) public addressesWithdrawLocks;
```

### Emitting Events

```
event ChangeLockDuration(uint256 newLockDuration);
event ChangeLockAmount(uint256 newLockAmount);
event ChangeSpamPenaltyFactor(uint256 newSpamPenaltyFactor);
event NewLock(address lockAddress, uint256 unlockTime, uint256 lockAmount);
event Withdrawal(address withdrawalAddress ,uint256 withdrawalLockCount);
```

### Initializing The Time Lock App

```
/**
* @notice Initialize the Time Lock app
* @param _token The token which will be locked when forwarding actions
* @param _lockDuration The duration tokens will be locked before being able to be withdrawn
* @param _lockAmount The amount of the token that is locked for each forwarded action
* @param _spamPenaltyFactor The spam penalty factor (`_spamPenaltyFactor / PCT_BASE`)
*/
function initialize(address _token, uint256 _lockDuration, uint256 _lockAmount, uint256 _spamPenaltyFactor) external onlyInit {
		token = ERC20(_token);
		lockDuration = _lockDuration;
		lockAmount = _lockAmount;
		spamPenaltyFactor = _spamPenaltyFactor;

		initialized();
}
```

### Changing Global Parameters

These functions allow changes to the standard parameters for the time lock app. We anticipate the `CHANGE_DURATION_ROLE`, `CHANGE_AMOUNT_ROLE`, and `CHANGE_SPAM_PENALTY_ROLE` to be set to the `Voting` app or to an administrative member of the DAO.

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
* @notice Change spam penalty factor to `_spamPenaltyFactor`
* @param _spamPenaltyFactor The new spam penalty factor
*/
function changeSpamPenaltyFactor(uint256 _spamPenaltyFactor) external auth(CHANGE_SPAM_PENALTY_ROLE) {
		spamPenaltyFactor = _spamPenaltyFactor;
		emit ChangeSpamPenaltyFactor(_spamPenaltyFactor);
}
```

### Withdrawing Locks

`withdrawTokens()` allows the caller to withdraw all available tokens while the `withdrawTokens(uint256 _numberWithdrawLocks)` allows the callers to specify how many locks to withdraw.

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
* @notice Tells the forward fee token and amount of the Time Lock app
* @dev IFeeForwarder interface conformance
*      Note that the Time Lock app has to be the first forwarder in the transaction path, it must be called by an EOA not another forwarder, in order for the spam penalty mechanism to work
* @return Forwarder token address
* @return Forwarder lock amount
*/
function forwardFee() external view returns (address, uint256) {
		(uint256 _spamPenaltyAmount, ) = getSpamPenalty();

		uint256 totalLockAmountRequired = lockAmount.add(_spamPenaltyAmount);

		return (address(token), totalLockAmountRequired);
}
```

`isForwarder()` ensures that the time lock app can forward intents

```
/**
* @notice Tells whether the Time Lock app is a forwarder or not
* @dev IForwarder interface conformance
* @return Always true
*/
function isForwarder() external pure returns (bool) {
		return true;
}
```

`canForward()` checks if the `msg.sender` can forward an intent. This permission can be set to any app, but in the Dandelion Org Template we set it to a [Token Balance Oracle](https://github.com/1Hive/token-oracle) that checks if the address that is trying to forward an intent is also a DAO token holder

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
* @notice Locks `@tokenAmount(self.token(): address, self.getSpamPenalty(): uint + self.lockAmount(): uint)` tokens and executes desired action
* @dev IForwarder interface conformance. Consider using pretransaction on UI for necessary approval.
*      Note that the Time Lock app has to be the first forwarder in the transaction path, it must be called by an EOA not another forwarder, in order for the spam penalty mechanism to work
* @param _evmCallScript Script to execute
*/
function forward(bytes _evmCallScript) public {
		require(canForward(msg.sender, _evmCallScript), ERROR_CAN_NOT_FORWARD);

		(uint256 spamPenaltyAmount, uint256 spamPenaltyDuration) = getSpamPenalty();

		uint256 totalAmount = lockAmount.add(spamPenaltyAmount);
		uint256 totalDuration = lockDuration.add(spamPenaltyDuration);

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

`getSpamPenalty()` calculates the amount and duration penalty of `msg.sender`

```
/**
* @notice Get's amount and duration penalty based on the number of current locks `msg.sender` has
* @return amount penalty
* @return duration penalty
*/
function getSpamPenalty() public view returns (uint256, uint256) {
		WithdrawLockLib.WithdrawLock[] memory addressWithdrawLocks = addressesWithdrawLocks[msg.sender];

		uint256 activeLocks = 0;
		for (uint256 withdrawLockIndex = 0; withdrawLockIndex < addressWithdrawLocks.length; withdrawLockIndex++) {
				if (getTimestamp() < addressWithdrawLocks[withdrawLockIndex].unlockTime) {
						activeLocks += 1;
				}
		}

		return (lockAmount.mul(activeLocks).mul(spamPenaltyFactor).div(PCT_BASE), lockDuration.mul(activeLocks).mul(spamPenaltyFactor).div(PCT_BASE));
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
		// The use of withdrawLockCount variable is only to keep a count of how many locks are going to be witdrawn so we can emit an event that the frontend will be listening to so we can react to it.
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
		// emitting an event for the front end to display
		emit Withdrawal(_sender, withdrawLockCount);
}
```
