/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 *
 * This file requires contract dependencies which are licensed as
 * GPL-3.0-or-later, forcing it to also be licensed as such.
 *
 * This is the only file in your project that requires this license and
 * you are free to choose a different license for the rest of the project.
 */

pragma solidity ^0.4.24;


import "@aragon/os/contracts/factory/DAOFactory.sol";
import "@aragon/os/contracts/apm/Repo.sol";
import "@aragon/os/contracts/lib/ens/ENS.sol";
import "@aragon/os/contracts/lib/ens/PublicResolver.sol";
import "@aragon/os/contracts/apm/APMNamehash.sol";
import "@aragon/apps-finance/contracts/Finance.sol";
import "@aragon/apps-voting/contracts/Voting.sol";
import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";
import "./Oracle.sol";
import "../Lock.sol";

contract TemplateBase is APMNamehash {
    ENS public ens;
    DAOFactory public fac;

    event DeployInstance(address dao);
    event InstalledApp(address appProxy, bytes32 appId);

    constructor(DAOFactory _fac, ENS _ens) public {
        ens = _ens;

        // If no factory is passed, get it from on-chain bare-kit
        if (address(_fac) == address(0)) {
            bytes32 bareKit = apmNamehash("bare-kit");
            fac = TemplateBase(latestVersionAppBase(bareKit)).fac();
        } else {
            fac = _fac;
        }
    }

    function latestVersionAppBase(bytes32 appId) public view returns (address base) {
        Repo repo = Repo(PublicResolver(ens.resolver(appId)).addr(appId));
        (,base,) = repo.getLatest();

        return base;
    }

    function installApp(Kernel dao, bytes32 appId) internal returns (address) {
        address instance = address(dao.newAppInstance(appId, latestVersionAppBase(appId)));
        emit InstalledApp(instance, appId);
        return instance;
    }

    function installDefaultApp(Kernel dao, bytes32 appId) internal returns (address) {
        address instance = address(dao.newAppInstance(appId, latestVersionAppBase(appId), new bytes(0), true));
        emit InstalledApp(instance, appId);
        return instance;
    }
}


contract Template is TemplateBase {

    uint64 constant PCT = 10 ** 16;
    address constant ANY_ENTITY = address(-1);

    uint8 constant ORACLE_PARAM_ID = 203;
    enum Op { NONE, EQ, NEQ, GT, LT, GTE, LTE, RET, NOT, AND, OR, XOR, IF_ELSE } // op types

    bytes32 internal FINANCE_APP_ID = apmNamehash("finance");
    bytes32 internal LOCK_APP_ID = keccak256(abi.encodePacked(apmNamehash("open"), keccak256("lock")));
    bytes32 internal TOKEN_MANAGER_APP_ID = apmNamehash("token-manager");
    bytes32 internal VAULT_APP_ID = apmNamehash("vault");
    bytes32 internal VOTING_APP_ID = apmNamehash("voting");

    MiniMeTokenFactory tokenFactory;

    constructor(ENS ens) TemplateBase(DAOFactory(0), ens) public {
        tokenFactory = new MiniMeTokenFactory();
    }

    function newInstance() public {
        address root = msg.sender;
        Kernel dao = fac.newDAO(this);
        ACL acl = ACL(dao.acl());
        acl.createPermission(this, dao, dao.APP_MANAGER_ROLE(), this);

        Finance finance = Finance(installApp(dao, FINANCE_APP_ID));
        Lock lock = Lock(installApp(dao, LOCK_APP_ID));
        Oracle oracle = new Oracle();
        TokenManager tokenManager = TokenManager(installApp(dao, TOKEN_MANAGER_APP_ID));
        Vault vault = Vault(installDefaultApp(dao, VAULT_APP_ID));
        Voting voting = Voting(installApp(dao, VOTING_APP_ID));

        MiniMeToken lockToken = tokenFactory.createCloneToken(MiniMeToken(0), 0, "Lock token", 18, "LKT", true);
        lockToken.generateTokens(root, 300e18);
        lockToken.changeController(root);

        MiniMeToken token = tokenFactory.createCloneToken(MiniMeToken(0), 0, "Test token", 18, "TST", true);
        token.changeController(tokenManager);

        // Initialize apps
        vault.initialize();
        finance.initialize(vault, 30 days);
        lock.initialize(ERC20(lockToken), 90, 20e18);
        tokenManager.initialize(token, true, 0);
        voting.initialize(token, 50 * PCT, 20 * PCT, 1 days);

        acl.createPermission(this, tokenManager, tokenManager.MINT_ROLE(), this);
        acl.createPermission(voting, tokenManager, tokenManager.BURN_ROLE(), root);
        tokenManager.mint(root, 10e18); // Give ten tokens to root

        acl.createPermission(lock, voting, voting.CREATE_VOTES_ROLE(), voting);

        acl.createPermission(finance, vault, vault.TRANSFER_ROLE(), voting);
        acl.createPermission(voting, finance, finance.CREATE_PAYMENTS_ROLE(), voting);
        acl.createPermission(voting, finance, finance.EXECUTE_PAYMENTS_ROLE(), voting);
        acl.createPermission(voting, finance, finance.MANAGE_PAYMENTS_ROLE(), voting);

        acl.createPermission(root, lock, lock.CHANGE_DURATION_ROLE(), voting);
        acl.createPermission(root, lock, lock.CHANGE_AMOUNT_ROLE(), voting);

        acl.createPermission(this,lock,lock.LOCK_TOKENS_ROLE(), this);
        // creating param for dissent oracle (the idea here is when an entity tries to mint tokens, it first checks with the oracle)
        setOracle(acl, ANY_ENTITY, lock, lock.LOCK_TOKENS_ROLE(), oracle);

        // Clean up permissions
        acl.grantPermission(root, dao, dao.APP_MANAGER_ROLE());
        acl.revokePermission(this, dao, dao.APP_MANAGER_ROLE());
        acl.setPermissionManager(root, dao, dao.APP_MANAGER_ROLE());

        acl.grantPermission(root, acl, acl.CREATE_PERMISSIONS_ROLE());
        acl.revokePermission(this, acl, acl.CREATE_PERMISSIONS_ROLE());
        acl.setPermissionManager(root, acl, acl.CREATE_PERMISSIONS_ROLE());

        acl.grantPermission(voting, tokenManager, tokenManager.MINT_ROLE());
        acl.revokePermission(this, tokenManager, tokenManager.MINT_ROLE());
        acl.setPermissionManager(root, tokenManager, tokenManager.MINT_ROLE());

        acl.revokePermission(this, lock, lock.LOCK_TOKENS_ROLE());
        acl.setPermissionManager(root, lock, lock.LOCK_TOKENS_ROLE());

        emit DeployInstance(dao);

    }

    function setOracle(ACL acl, address who, address where, bytes32 what, address oracle) internal {
        uint256[] memory params = new uint256[](1);
        params[0] = paramsTo256(ORACLE_PARAM_ID,uint8(Op.EQ),uint240(oracle));
        acl.grantPermissionP(who, where, what, params);
    }

    function paramsTo256(uint8 id,uint8 op, uint240 value) internal returns (uint256) {
        return (uint256(id) << 248) + (uint256(op) << 240) + value;
    }
}