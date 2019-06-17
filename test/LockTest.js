import DaoDeployment from './helpers/DaoDeployment'
import {deployedContract} from "./helpers/helpers"
const Lock = artifacts.require('Lock')
// const Erc20 = artifacts.require('BasicErc20')

contract('Lock', ([rootAccount, ...accounts]) => {

    let daoDeployment = new DaoDeployment()
    let lockBase, lockForwarder

    before(async () => {
        await daoDeployment.deployBefore()
        lockBase = await Lock.new()
    })

    beforeEach(async () => {
        await daoDeployment.deployBeforeEach(rootAccount)
        const newLockAppReceipt = await daoDeployment.kernel.newAppInstance('0x1234', lockBase.address, '0x', false, {from: rootAccount})
        lockForwarder = await Lock.at(deployedContract(newLockAppReceipt))

    })

    describe('initialize(address _token, uint256 _lockDuration, uint256 _lockAmount)', () => {

        it ('sets variables as expected', async () => {

        })
    })
})