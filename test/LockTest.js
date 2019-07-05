import DaoDeployment from './helpers/DaoDeployment'
import {deployedContract} from "./helpers/helpers"
const Lock = artifacts.require('Lock')
const MockErc20 = artifacts.require('TokenMock')

contract('Lock', ([rootAccount, ...accounts]) => {

    let daoDeployment = new DaoDeployment()
    let lockBase, lockForwarder, mockErc20
    let CHANGE_DURATION_ROLE, CHANGE_AMOUNT_ROLE

    const MOCK_TOKEN_BALANCE = 1000
    const INITIAL_LOCK_DURATION = 60 // seconds
    const INITIAL_LOCK_AMOUNT = 10

    before(async () => {
        await daoDeployment.deployBefore()
        lockBase = await Lock.new()
        CHANGE_DURATION_ROLE = await lockBase.CHANGE_DURATION_ROLE()
        CHANGE_AMOUNT_ROLE = await lockBase.CHANGE_AMOUNT_ROLE()
    })

    beforeEach(async () => {
        await daoDeployment.deployBeforeEach(rootAccount)
        const newLockAppReceipt = await daoDeployment.kernel.newAppInstance('0x1234', lockBase.address, '0x', false, {from: rootAccount})
        lockForwarder = await Lock.at(deployedContract(newLockAppReceipt))
        mockErc20 = await MockErc20.new(rootAccount, MOCK_TOKEN_BALANCE)
    })

    describe('initialize(address _token, uint256 _lockDuration, uint256 _lockAmount)', () => {

        beforeEach(async () => {
            lockForwarder.initialize(mockErc20.address, INITIAL_LOCK_DURATION, INITIAL_LOCK_AMOUNT)
        })

        it('sets variables as expected', async () => {
            const actualToken = await lockForwarder.token()
            const actualLockDuration = await lockForwarder.lockDuration()
            const actualLockAmount = await lockForwarder.lockAmount()
            const hasInitialized = await lockForwarder.hasInitialized()

            assert.strictEqual(actualToken, mockErc20.address)
            assert.strictEqual(actualLockDuration.toNumber(), INITIAL_LOCK_DURATION)
            assert.strictEqual(actualLockAmount.toNumber(), INITIAL_LOCK_AMOUNT)
            assert.isTrue(hasInitialized)
        })

        describe('changeLockDuration(uint256 _lockDuration)', () => {

            it('sets a new lock duration', async () => {
                await daoDeployment.acl.createPermission(rootAccount, lockForwarder.address, CHANGE_DURATION_ROLE, rootAccount)
                const expectedLockDuration = 120

                await lockForwarder.changeLockDuration(expectedLockDuration)

                const actualLockDuration = await lockForwarder.lockDuration()
                assert.strictEqual(actualLockDuration.toNumber(), expectedLockDuration)
            })
        })

        describe('changeLockAmount(uint256 _lockAmount)', () => {

            it('sets a new lock amount', async () => {
                await daoDeployment.acl.createPermission(rootAccount, lockForwarder.address, CHANGE_AMOUNT_ROLE, rootAccount)
                const expectedLockAmount = 20

                await lockForwarder.changeLockAmount(expectedLockAmount)

                const actualLockAmount = await lockForwarder.lockAmount()
                assert.strictEqual(actualLockAmount.toNumber(), expectedLockAmount)
            })
        })
    })
})