const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const { encodeCallScript } = require('@aragon/test-helpers/evmScript')

const ExecutionTarget = artifacts.require('ExecutionTarget')
const Lock = artifacts.require('LockMock')
const MockErc20 = artifacts.require('TokenMock')

import DaoDeployment from './helpers/DaoDeployment'
import { deployedContract } from './helpers/helpers'

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
    const newLockAppReceipt = await daoDeployment.kernel.newAppInstance('0x1234', lockBase.address, '0x', false, {
      from: rootAccount,
    })
    lockForwarder = await Lock.at(deployedContract(newLockAppReceipt))
    mockErc20 = await MockErc20.new(rootAccount, MOCK_TOKEN_BALANCE)
  })

  describe('initialize(address _token, uint256 _lockDuration, uint256 _lockAmount)', () => {
    beforeEach(async () => {
      await lockForwarder.initialize(mockErc20.address, INITIAL_LOCK_DURATION, INITIAL_LOCK_AMOUNT)
    })

    it('sets variables as expected', async () => {
      const actualToken = await lockForwarder.token()
      const actualLockDuration = await lockForwarder.lockDuration()
      const actualLockAmount = await lockForwarder.lockAmount()
      const hasInitialized = await lockForwarder.hasInitialized()

      assert.strictEqual(actualToken, mockErc20.address)
      assert.equal(actualLockDuration, INITIAL_LOCK_DURATION)
      assert.equal(actualLockAmount, INITIAL_LOCK_AMOUNT)
      assert.isTrue(hasInitialized)
    })

    it('checks it is forwarder', async () => {
      assert.isTrue(await lockForwarder.isForwarder())
    })

    describe('changeLockDuration(uint256 _lockDuration)', () => {
      it('sets a new lock duration', async () => {
        await daoDeployment.acl.createPermission(rootAccount, lockForwarder.address, CHANGE_DURATION_ROLE, rootAccount)
        const expectedLockDuration = 120

        await lockForwarder.changeLockDuration(expectedLockDuration)

        const actualLockDuration = await lockForwarder.lockDuration()
        assert.equal(actualLockDuration, expectedLockDuration)
      })
    })

    describe('changeLockAmount(uint256 _lockAmount)', () => {
      it('sets a new lock amount', async () => {
        await daoDeployment.acl.createPermission(rootAccount, lockForwarder.address, CHANGE_AMOUNT_ROLE, rootAccount)
        const expectedLockAmount = 20

        await lockForwarder.changeLockAmount(expectedLockAmount)

        const actualLockAmount = await lockForwarder.lockAmount()
        assert.equal(actualLockAmount, expectedLockAmount)
      })
    })

    describe('forward(bytes _evmCallScript)', async () => {
      let executionTarget, script
      let addressLocks = 0

      beforeEach(async () => {
        //create script
        executionTarget = await ExecutionTarget.new()
        const action = {
          to: executionTarget.address,
          calldata: executionTarget.contract.execute.getData(),
        }
        script = encodeCallScript([action])
      })

      it('forwards action successfully', async () => {
        await mockErc20.approve(lockForwarder.address, INITIAL_LOCK_AMOUNT, { from: rootAccount })
        await lockForwarder.forward(script, { from: rootAccount })

        const expectedNumberOfLocks = addressLocks + 1
        const actualNumberOfLocks = await lockForwarder.getNumberOfLocks(rootAccount)

        const [_, lockAmount] = await lockForwarder.addressesWithdrawLocks(rootAccount, 0)
        const expectedBalance = MOCK_TOKEN_BALANCE - INITIAL_LOCK_AMOUNT

        //forwarded successfully
        assert.equal(await executionTarget.counter(), 1)

        //transfered tokens successfully
        assert.equal(await mockErc20.balanceOf(rootAccount), expectedBalance)
        assert.equal(await mockErc20.balanceOf(lockForwarder.address), INITIAL_LOCK_AMOUNT)

        //lock created successfully
        assert.equal(expectedNumberOfLocks, actualNumberOfLocks)
        assert.equal(lockAmount, INITIAL_LOCK_AMOUNT)
      })

      it('cannot forward action', async () => {
        //forward without approving lock-app to make the transfer
        await assertRevert(lockForwarder.forward(script, { from: rootAccount }), 'LOCK_CAN_NOT_FORWARD')
      })
    })

    describe('withdrawTokens()', async () => {
      let numberOfLocks = 3

      beforeEach(async () => {
        //create script
        const executionTarget = await ExecutionTarget.new()
        const action = {
          to: executionTarget.address,
          calldata: executionTarget.contract.execute.getData(),
        }
        const script = encodeCallScript([action])

        await mockErc20.approve(lockForwarder.address, numberOfLocks * INITIAL_LOCK_AMOUNT, {
          from: rootAccount,
        })

        for (let i = 0; i < numberOfLocks; i++) await lockForwarder.forward(script, { from: rootAccount })
      })

      it("doesn't withdraw tokens (unlock time has not elapsed)", async () => {
        await lockForwarder.withdrawTokens(numberOfLocks, { from: rootAccount })

        const expectedNumberOfLocks = numberOfLocks
        const actualNumberOfLocks = await lockForwarder.getNumberOfLocks(rootAccount)

        assert.equal(expectedNumberOfLocks, actualNumberOfLocks)
      })

      it("can't withdraw more than locked", async () => {
        await assertRevert(lockForwarder.withdrawTokens(numberOfLocks + 1), 'LOCK_TOO_MANY_WITHDRAW_LOCKS')
      })

      it('withdraws 1 locked token', async () => {
        const locksToWithdraw = 1
        //increase time
        await lockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)

        const addressPrevBalance = await mockErc20.balanceOf(rootAccount)
        await lockForwarder.withdrawTokens(locksToWithdraw, { from: rootAccount })

        const expectedBalance = addressPrevBalance.toNumber() + locksToWithdraw * INITIAL_LOCK_AMOUNT

        assert.equal(expectedBalance, await mockErc20.balanceOf(rootAccount))
        assert.equal(numberOfLocks - 1, await lockForwarder.getNumberOfLocks(rootAccount))
      })

      //Having issue when calling withdrawTokens() (Invalid number of arguments in Solidity function)
      it(`withdraws all locked tokens (${numberOfLocks})`, async () => {
        //increase time
        await lockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)
        await lockForwarder.withdrawTokens(numberOfLocks, { from: rootAccount })

        assert.equal(0, await lockForwarder.getNumberOfLocks(rootAccount))
      })

      describe('Change configuration parameters', async () => {
        beforeEach(async () => {
          await daoDeployment.acl.createPermission(
            rootAccount,
            lockForwarder.address,
            CHANGE_DURATION_ROLE,
            rootAccount
          )
          await daoDeployment.acl.createPermission(rootAccount, lockForwarder.address, CHANGE_AMOUNT_ROLE, rootAccount)
        })

        it("does not change current locks's unlockTime", async () => {
          const locksToWithdraw = 1
          const newLockDuration = 120
          await lockForwarder.changeLockDuration(newLockDuration)

          //current locks's unlockTime is 60
          await lockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)
          await lockForwarder.withdrawTokens(locksToWithdraw, { from: rootAccount })

          assert.equal(numberOfLocks - locksToWithdraw, await lockForwarder.getNumberOfLocks(rootAccount))
        })

        it("does not change current locks's lockAmount", async () => {
          const locksToWithdraw = 1
          const previousBalance = await mockErc20.balanceOf(rootAccount)
          const newLockAmount = 20

          await lockForwarder.changeLockAmount(newLockAmount)

          //current locks's lockAmount is 10
          await lockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)
          await lockForwarder.withdrawTokens(locksToWithdraw, { from: rootAccount })

          assert.equal(previousBalance.toNumber() + INITIAL_LOCK_AMOUNT, await mockErc20.balanceOf(rootAccount))
        })
      })
    })
  })
})
