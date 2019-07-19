const { assertRevert } = require('./helpers/helpers')
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

    it("get's forwarding fee information", async () => {
      const [actualToken, actualLockAmount] = Object.values(await lockForwarder.forwardFee())

      assert.strictEqual(actualToken, mockErc20.address)
      assert.equal(actualLockAmount, INITIAL_LOCK_AMOUNT)
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
          calldata: executionTarget.contract.methods.execute().encodeABI(),
        }
        script = encodeCallScript([action])
      })

      //should this test be done separately in say, 3 tests?
      it('forwards action successfully', async () => {
        await mockErc20.approve(lockForwarder.address, INITIAL_LOCK_AMOUNT, {
          from: rootAccount,
        })

        const expectedCounter = 1
        const expectedLockerBalance = MOCK_TOKEN_BALANCE - INITIAL_LOCK_AMOUNT
        const expectedLockAppBalance = INITIAL_LOCK_AMOUNT
        const expectedNumberOfLocks = addressLocks + 1
        const expectedLockAmount = INITIAL_LOCK_AMOUNT

        await lockForwarder.forward(script, { from: rootAccount })

        const actualCounter = await executionTarget.counter()
        const actualLockerBalance = await mockErc20.balanceOf(rootAccount)
        const actualLockAppBalance = await mockErc20.balanceOf(lockForwarder.address)
        const actualNumberOfLocks = await lockForwarder.getWithdrawLocksCount(rootAccount)
        const { lockAmount: actualLockAmount } = await lockForwarder.addressesWithdrawLocks(rootAccount, 0)

        //forwarded successfully
        assert.equal(actualCounter, expectedCounter)

        //transfered tokens successfully
        assert.equal(actualLockerBalance, expectedLockerBalance)
        assert.equal(actualLockAppBalance, expectedLockAppBalance)

        //lock created successfully
        assert.equal(actualNumberOfLocks, expectedNumberOfLocks)
        assert.equal(actualLockAmount, expectedLockAmount)
      })

      it('cannot forward action without approving lock-app to make the transfer', async () => {
        await assertRevert(lockForwarder.forward(script, { from: rootAccount }), 'LOCK_CAN_NOT_FORWARD')
      })

      describe('withdrawTokens()', async () => {
        let lockCount = 3

        beforeEach(async () => {
          await mockErc20.approve(lockForwarder.address, lockCount * INITIAL_LOCK_AMOUNT, {
            from: rootAccount,
          })

          for (let i = 0; i < lockCount; i++) await lockForwarder.forward(script, { from: rootAccount })
        })

        it("doesn't withdraw tokens before lock duration has elapsed", async () => {
          const expectedLockCount = lockCount

          await lockForwarder.withdrawTokens(lockCount, { from: rootAccount })

          const actualLockCount = await lockForwarder.getWithdrawLocksCount(rootAccount)
          assert.equal(actualLockCount, expectedLockCount)
        })

        it("can't withdraw more than locked", async () => {
          await assertRevert(lockForwarder.withdrawTokens(lockCount + 1), 'LOCK_TOO_MANY_WITHDRAW_LOCKS')
        })

        it('withdraws 1 locked token', async () => {
          const locksToWithdraw = 1
          const addressPrevBalance = await mockErc20.balanceOf(rootAccount)

          const expectedLockCount = lockCount - locksToWithdraw
          const expectedBalance = addressPrevBalance.toNumber() + locksToWithdraw * INITIAL_LOCK_AMOUNT

          //increase time
          await lockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)
          await lockForwarder.withdrawTokens(locksToWithdraw, {
            from: rootAccount,
          })

          const actualLockCount = await lockForwarder.getWithdrawLocksCount(rootAccount)
          const actualBalance = await mockErc20.balanceOf(rootAccount)
          assert.equal(actualLockCount, expectedLockCount)
          assert.equal(actualBalance, expectedBalance)
        })

        //Having issue when calling withdrawTokens() (Invalid number of arguments in Solidity function)
        it(`withdraws all locked tokens (${lockCount})`, async () => {
          const expectedLockCount = 0

          //increase time
          await lockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)
          await lockForwarder.withdrawTokens(lockCount, { from: rootAccount })

          const actualLockCount = await lockForwarder.getWithdrawLocksCount(rootAccount)
          assert.equal(actualLockCount, expectedLockCount)
        })

        describe('changeLockDuration(uint256 _lockDuration)', async () => {
          beforeEach(async () => {
            await daoDeployment.acl.createPermission(
              rootAccount,
              lockForwarder.address,
              CHANGE_DURATION_ROLE,
              rootAccount
            )
          })

          it("does not change current locks's unlockTime", async () => {
            const locksToWithdraw = 1
            const newLockDuration = 120

            const expectedLockCount = lockCount - locksToWithdraw

            await lockForwarder.changeLockDuration(newLockDuration)
            //current locks's unlockTime is 60
            await lockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)
            await lockForwarder.withdrawTokens(locksToWithdraw, {
              from: rootAccount,
            })

            const actualLockCount = await lockForwarder.getWithdrawLocksCount(rootAccount)
            assert.equal(actualLockCount, expectedLockCount)
          })
        })

        describe('changeLockAmount(uint256 _lockAmount)', async () => {
          beforeEach(async () => {
            await daoDeployment.acl.createPermission(
              rootAccount,
              lockForwarder.address,
              CHANGE_AMOUNT_ROLE,
              rootAccount
            )
          })

          it("does not change current locks's lockAmount", async () => {
            const locksToWithdraw = 1
            const previousBalance = await mockErc20.balanceOf(rootAccount)
            const newLockAmount = 20

            const expectedBalance = previousBalance.toNumber() + INITIAL_LOCK_AMOUNT

            await lockForwarder.changeLockAmount(newLockAmount)
            //current locks's lockAmount is 10
            await lockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)
            await lockForwarder.withdrawTokens(locksToWithdraw, {
              from: rootAccount,
            })

            const actualBalance = await mockErc20.balanceOf(rootAccount)
            assert.equal(actualBalance, expectedBalance)
          })
        })
      })
    })
  })
})
