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
  let CHANGE_DURATION_ROLE, CHANGE_AMOUNT_ROLE, LOCK_TOKENS_ROLE, CHANGE_SPAM_PENALTY_ROLE

  const MOCK_TOKEN_BALANCE = 1000
  const INITIAL_LOCK_DURATION = 60 // seconds
  const INITIAL_LOCK_AMOUNT = 10
  const WHOLE_SPAM_PENALTY = 100
  const INITIAL_SPAM_PENALTY_FACTOR = 50 // 50%

  before('deploy DAO', async () => {
    await daoDeployment.deployBefore()
    lockBase = await Lock.new()
    CHANGE_DURATION_ROLE = await lockBase.CHANGE_DURATION_ROLE()
    CHANGE_AMOUNT_ROLE = await lockBase.CHANGE_AMOUNT_ROLE()
    CHANGE_SPAM_PENALTY_ROLE = await lockBase.CHANGE_SPAM_PENALTY_ROLE()
    LOCK_TOKENS_ROLE = await lockBase.LOCK_TOKENS_ROLE()
  })

  beforeEach('install lock-app', async () => {
    await daoDeployment.deployBeforeEach(rootAccount)
    const newLockAppReceipt = await daoDeployment.kernel.newAppInstance('0x1234', lockBase.address, '0x', false, {
      from: rootAccount,
    })
    lockForwarder = await Lock.at(deployedContract(newLockAppReceipt))
    mockErc20 = await MockErc20.new(rootAccount, MOCK_TOKEN_BALANCE)
  })

  describe('initialize(address _token, uint256 _lockDuration, uint256 _lockAmount)', () => {
    beforeEach('initialize lock-app', async () => {
      await lockForwarder.initialize(
        mockErc20.address,
        INITIAL_LOCK_DURATION,
        INITIAL_LOCK_AMOUNT,
        INITIAL_SPAM_PENALTY_FACTOR
      )
    })

    it('sets variables as expected', async () => {
      const actualToken = await lockForwarder.token()
      const actualLockDuration = await lockForwarder.lockDuration()
      const actualLockAmount = await lockForwarder.lockAmount()
      const actualSpamPenaltyFactor = await lockForwarder.spamPenaltyFactor()
      const hasInitialized = await lockForwarder.hasInitialized()

      assert.strictEqual(actualToken, mockErc20.address)
      assert.equal(actualLockDuration, INITIAL_LOCK_DURATION)
      assert.equal(actualLockAmount, INITIAL_LOCK_AMOUNT)
      assert.equal(actualSpamPenaltyFactor, INITIAL_SPAM_PENALTY_FACTOR)
      assert.isTrue(hasInitialized)
    })

    it('checks it is a forwarder', async () => {
      assert.isTrue(await lockForwarder.isForwarder())
    })

    it('checks account can forward actions', async () => {
      await daoDeployment.acl.createPermission(rootAccount, lockForwarder.address, LOCK_TOKENS_ROLE, rootAccount)
      assert.isTrue(await lockForwarder.canForward(rootAccount, '0x'))
    })

    it('cannot forward if account not permitted to lock tokens ', async () => {
      assert.isFalse(await lockForwarder.canForward(rootAccount, '0x'))
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

    describe('changeSpamPenaltyFactor(uint256 _spamPenaltyFactor)', () => {
      it('sets a new spam penalty factor', async () => {
        await daoDeployment.acl.createPermission(rootAccount, lockForwarder.address, CHANGE_SPAM_PENALTY_ROLE, rootAccount)
        const expectedSpamPenaltyFactor = 100

        await lockForwarder.changeSpamPenaltyFactor(expectedSpamPenaltyFactor)

        const actualSpamPenaltyFactor = await lockForwarder.spamPenaltyFactor()
        assert.equal(actualSpamPenaltyFactor, expectedSpamPenaltyFactor)
      })
    })

    describe('forwardFee()', async () => {
      it("get's forwarding fee information", async () => {
        const [actualToken, actualLockAmount] = Object.values(await lockForwarder.forwardFee())

        assert.strictEqual(actualToken, mockErc20.address)
        assert.equal(actualLockAmount, INITIAL_LOCK_AMOUNT)
      })

      context('account has 1 active lock', async () => {
        beforeEach(async () => {
          const executionTarget = await ExecutionTarget.new()
          const action = {
            to: executionTarget.address,
            calldata: executionTarget.contract.methods.execute().encodeABI(),
          }
          const script = encodeCallScript([action])
          await daoDeployment.acl.createPermission(rootAccount, lockForwarder.address, LOCK_TOKENS_ROLE, rootAccount)
          await mockErc20.approve(lockForwarder.address, INITIAL_LOCK_AMOUNT, {
            from: rootAccount,
          })
          await lockForwarder.forward(script, { from: rootAccount })
        })

        it('forward fee increases for second lock', async () => {
          const [_, actualLockAmount] = Object.values(await lockForwarder.forwardFee({ from: rootAccount }))
          assert.equal(actualLockAmount, 15)
        })

        it('forward fee increases when increasing spam penalty factor', async () => {
          await daoDeployment.acl.createPermission(
            rootAccount,
            lockForwarder.address,
            CHANGE_SPAM_PENALTY_ROLE,
            rootAccount
          )
          await lockForwarder.changeSpamPenaltyFactor(100)
          const [_, actualLockAmount] = Object.values(await lockForwarder.forwardFee({ from: rootAccount }))

          assert.equal(actualLockAmount, 20)
        })
      })
    })

    describe('getSpamPenalty()', () => {
      it("get's spam penalty amount and duration", async () => {
        const [actualSpamPenaltyAmount, actualSpamPenaltyDuration] = Object.values(
          await lockForwarder.getSpamPenalty({ from: rootAccount })
        )

        assert.equal(actualSpamPenaltyAmount, 0)
        assert.equal(actualSpamPenaltyDuration, 0)
      })

      context('account has 1 active lock', async () => {
        beforeEach(async () => {
          const executionTarget = await ExecutionTarget.new()
          const action = {
            to: executionTarget.address,
            calldata: executionTarget.contract.methods.execute().encodeABI(),
          }
          const script = encodeCallScript([action])
          await daoDeployment.acl.createPermission(rootAccount, lockForwarder.address, LOCK_TOKENS_ROLE, rootAccount)
          await mockErc20.approve(lockForwarder.address, INITIAL_LOCK_AMOUNT, {
            from: rootAccount,
          })
          await lockForwarder.forward(script, { from: rootAccount })
        })

        it('spam penalty amount and duration increase for second lock', async () => {
          const [actualSpamPenaltyAmount, actualSpamPenaltyDuration] = Object.values(
            await lockForwarder.getSpamPenalty({ from: rootAccount })
          )

          assert.equal(actualSpamPenaltyAmount, 5)
          assert.equal(actualSpamPenaltyDuration, 30)
        })

        it('spam penalty amount and duration increase when increasing spam penalty factor', async () => {
          await daoDeployment.acl.createPermission(
            rootAccount,
            lockForwarder.address,
            CHANGE_SPAM_PENALTY_ROLE,
            rootAccount
          )
          await lockForwarder.changeSpamPenaltyFactor(100)

          const [actualSpamPenaltyAmount, actualSpamPenaltyDuration] = Object.values(
            await lockForwarder.getSpamPenalty({ from: rootAccount })
          )

          assert.equal(actualSpamPenaltyAmount, 10)
          assert.equal(actualSpamPenaltyDuration, 60)
        })
      })
    })

    describe('forward(bytes _evmCallScript)', async () => {
      let executionTarget, script
      let addressLocks = 0

      beforeEach('create execution script', async () => {
        await daoDeployment.acl.createPermission(rootAccount, lockForwarder.address, LOCK_TOKENS_ROLE, rootAccount)

        //create script
        executionTarget = await ExecutionTarget.new()
        const action = {
          to: executionTarget.address,
          calldata: executionTarget.contract.methods.execute().encodeABI(),
        }
        script = encodeCallScript([action])
      })

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

      it('cannot forward if sender does not approve lock app to transfer tokens', async () => {
        await assertRevert(lockForwarder.forward(script, { from: rootAccount }), 'LOCK_TRANSFER_REVERTED')
      })

      context('account has 1 active lock', async () => {
        beforeEach(async () => {
          await mockErc20.approve(lockForwarder.address, INITIAL_LOCK_AMOUNT, {
            from: rootAccount,
          })
          await lockForwarder.forward(script, { from: rootAccount })
        })

        it('lock amount increases for second lock', async () => {
          const expectedLockAmount = 15

          await mockErc20.approve(lockForwarder.address, expectedLockAmount, {
            from: rootAccount,
          })
          await lockForwarder.forward(script, { from: rootAccount })

          const { lockAmount: actualLockAmount } = await lockForwarder.addressesWithdrawLocks(rootAccount, 1)
          assert.equal(actualLockAmount, expectedLockAmount)
        })

        it('lock amount increases when increasing spam penalty factor', async () => {
          await daoDeployment.acl.createPermission(
            rootAccount,
            lockForwarder.address,
            CHANGE_SPAM_PENALTY_ROLE,
            rootAccount
          )
          await lockForwarder.changeSpamPenaltyFactor(100)
          const expectedLockAmount = 20

          await mockErc20.approve(lockForwarder.address, expectedLockAmount, {
            from: rootAccount,
          })
          await lockForwarder.forward(script, { from: rootAccount })

          const { lockAmount: actualLockAmount } = await lockForwarder.addressesWithdrawLocks(rootAccount, 1)
          assert.equal(actualLockAmount, expectedLockAmount)
        })
      })

      describe('withdrawTokens()', async () => {
        let lockCount = 3

        beforeEach('Forward actions', async () => {
          let spamPenalty
          let spamPenaltyPct = INITIAL_SPAM_PENALTY_FACTOR / WHOLE_SPAM_PENALTY

          for (let i = 0; i < lockCount; i++) {
            spamPenalty = i * INITIAL_LOCK_AMOUNT * spamPenaltyPct
            await mockErc20.approve(lockForwarder.address, INITIAL_LOCK_AMOUNT + spamPenalty, {
              from: rootAccount,
            })
            await lockForwarder.forward(script, { from: rootAccount })
          }
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
          await lockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION * lockCount + 1)
          await lockForwarder.withdrawTokens()

          const actualLockCount = await lockForwarder.getWithdrawLocksCount(rootAccount)
          assert.equal(actualLockCount, expectedLockCount)
        })

        describe('change lock duration', async () => {
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

        describe('change lock amount', async () => {
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

  describe('app not initialized', () => {
    it('reverts on forwarding', async () => {
      await assertRevert(lockForwarder.forward('0x', { from: rootAccount }), 'LOCK_CAN_NOT_FORWARD')
    })

    it('reverts on changing duration', async () => {
      await assertRevert(lockForwarder.changeLockDuration(20), 'APP_AUTH_FAILED')
    })

    it('reverts on changing amount', async () => {
      await assertRevert(lockForwarder.changeLockAmount(10), 'APP_AUTH_FAILED')
    })

    it('reverts on changing spam penalty factor', async () => {
      await assertRevert(lockForwarder.changeSpamPenaltyFactor(10), 'APP_AUTH_FAILED')
    })

    it('reverts on withdrawing tokens', async () => {
      await assertRevert(lockForwarder.withdrawTokens())
    })
  })
})
