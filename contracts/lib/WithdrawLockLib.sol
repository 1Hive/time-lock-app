pragma solidity ^0.4.24;


library WithdrawLockLib {

    struct WithdrawLock {
        uint256 unlockTime;
        uint256 lockAmount;
    }

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
}
