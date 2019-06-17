pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/IForwarder.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";

contract Lock is AragonApp, IForwarder {

    bytes32 constant public CHANGE_DURATION_ROLE = keccak256("CHANGE_DURATION_ROLE");
    bytes32 constant public CHANGE_AMOUNT_ROLE = keccak256("CHANGE_AMOUNT_ROLE");

    string private constant ERROR_NO_TOKENS_LOCKED = "LOCK_NO_TOKENS_LOCKED";
    string private constant ERROR_WITHIN_LOCK_DURATION = "LOCK_WITHIN_LOCK_DURATION";
    string private constant ERROR_CAN_NOT_FORWARD = "VOTING_CAN_NOT_FORWARD";

    event ChangeLockDuration(uint256 newLockDuration);
    event ChangeLockAmount(uint256 newLockAmount);

    struct TokenLock {
        bool tokensLocked;
        uint256 lockedUntil;
    }

    ERC20 token;
    uint256 lockDuration;
    uint256 lockAmount;
    mapping(address => TokenLock) lockedTokens;

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
        TokenLock storage tokenLock = lockedTokens[msg.sender];
        require(tokenLock.tokensLocked, ERROR_NO_TOKENS_LOCKED);
        require(now > tokenLock.lockedUntil, ERROR_WITHIN_LOCK_DURATION);

        tokenLock.tokensLocked = false;
        token.transfer(msg.sender, lockAmount);
    }

    function isForwarder() external pure returns (bool) {
        return true;
    }

    function canForward(address sender, bytes evmCallScript) public view returns (bool) {
        bool tokensLocked = lockedTokens[msg.sender].tokensLocked;
        bool allowanceAvailable = token.allowance(msg.sender, address(this)) >= lockAmount;

        return tokensLocked || allowanceAvailable;
    }

    // This requires approve be called before, not sure how to do this on the UI. Perhaps an approve pretransaction will work.
    function forward(bytes evmCallScript) public {
        require(canForward(msg.sender, _evmScript), ERROR_CAN_NOT_FORWARD);

        TokenLock storage tokenLock = lockedTokens[msg.sender];
        tokenLock.lockedUntil = now + lockDuration;

        if (!tokenLock.tokensLocked) {
            token.transferFrom(msg.sender, address(this), lockAmount);
            tokenLock.tokensLocked = true;
        }

        runScript(evmCallScript, new bytes(0), new address[](0));
    }
}
