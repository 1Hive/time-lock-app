pragma solidity ^0.4.24;


library WithdrawLockLib {

    struct WithdrawLock {
        uint256 unlockTime;
        uint256 lockAmount;
    }

    function deleteItem(WithdrawLock[] storage self, uint256 index) internal returns (bool) {
        uint256 newLength = self.length - 1;
        if (index != newLength) {
            self[index] = self[newLength];
		}

        delete self[newLength];
        self.length = newLength;

        return true;
    }

    function sort(WithdrawLock[] self) internal returns (WithdrawLock[]) {
        quickSort(self, 0, self.length - 1);
        return self;
    }

    function quickSort(WithdrawLock[] memory arr, uint256 low, uint256 high) internal {
        uint256 i = low;
        uint256 j = high;
        if (i == j)
		   return;

        uint256 pivot = arr[low + (high - low) / 2].unlockTime;
        while (i <= j) {
            while (arr[i].unlockTime < pivot) {
                i++;
            }
            while (pivot < arr[j].unlockTime) {
                j--;
            }
            if (i <= j) {
                (arr[i], arr[j]) = (arr[j], arr[i]);
                i++;
                j--;
            }
        }
        if (low < j)
            quickSort(arr, low, j);
        if (i < high)
            quickSort(arr, i, high);
    }
}