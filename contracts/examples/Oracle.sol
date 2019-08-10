pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/acl/IACLOracle.sol";


contract Oracle is AragonApp, IACLOracle {

    function initialize() external onlyInit {
        initialized();
    }

    /**
    * @notice ACLOracle
    * @dev IACLOracle interface conformance
    */
    function canPerform(address , address, bytes32, uint256[]) external view returns (bool) {
        return true;
    }
}