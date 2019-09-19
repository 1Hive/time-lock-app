const { assertRevert } = require('./helpers/helpers')
const { encodeCallScript } = require('@aragon/test-helpers/evmScript')
const ExecutionTarget = artifacts.require('ExecutionTarget')
const TimeLock = artifacts.require('TimeLockMock')
const MockErc20 = artifacts.require('TokenMock')

import BN from 'bn.js'
import DaoDeployment from './helpers/DaoDeployment'
import { deployedContract } from './helpers/helpers'

const bigExp = (x, y = 0) => new BN(x).mul(new BN(10).pow(new BN(y)))
const pct16 = x => bigExp(x, 16)
const decimals = 18

contract('TimeLock', ([rootAccount, ...accounts]) => {
  let daoDeployment = new DaoDeployment()
  let timeLockBase, timeLockForwarder, mockErc20
  let CHANGE_DURATION_ROLE,
    CHANGE_AMOUNT_ROLE,
    LOCK_TOKENS_ROLE,
    CHANGE_SPAM_PENALTY_ROLE

  const MOCK_TOKEN_BALANCE = bigExp(1000, decimals)
  const INITIAL_LOCK_AMOUNT = bigExp(10, decimals)
  const INITIAL_LOCK_DURATION = 60 // seconds
  const INITIAL_SPAM_PENALTY_FACTOR = pct16(50) // 50%

  before('deploy DAO', async () => {
    await daoDeployment.deployBefore()
    timeLockBase = await TimeLock.new()
    CHANGE_DURATION_ROLE = await timeLockBase.CHANGE_DURATION_ROLE()
    CHANGE_AMOUNT_ROLE = await timeLockBase.CHANGE_AMOUNT_ROLE()
    CHANGE_SPAM_PENALTY_ROLE = await timeLockBase.CHANGE_SPAM_PENALTY_ROLE()
    LOCK_TOKENS_ROLE = await timeLockBase.LOCK_TOKENS_ROLE()
  })

  beforeEach('install time-lock-app', async () => {
    await daoDeployment.deployBeforeEach(rootAccount)
    const newLockAppReceipt = await daoDeployment.kernel.newAppInstance(
      '0x1234',
      timeLockBase.address,
      '0x',
      false,
      {
        from: rootAccount,
      }
    )
    timeLockForwarder = await TimeLock.at(deployedContract(newLockAppReceipt))
    mockErc20 = await MockErc20.new(rootAccount, MOCK_TOKEN_BALANCE)
  })

  describe('initialize(address _token, uint256 _lockDuration, uint256 _lockAmount)', () => {
    beforeEach('initialize time-lock-app', async () => {
      await timeLockForwarder.initialize(
        mockErc20.address,
        INITIAL_LOCK_DURATION,
        INITIAL_LOCK_AMOUNT,
        INITIAL_SPAM_PENALTY_FACTOR
      )
    })

    it('sets variables as expected', async () => {
      const actualToken = await timeLockForwarder.token()
      const actualLockDuration = await timeLockForwarder.lockDuration()
      const actualLockAmount = await timeLockForwarder.lockAmount()
      const actualSpamPenaltyFactor = await timeLockForwarder.spamPenaltyFactor()
      const hasInitialized = await timeLockForwarder.hasInitialized()

      assert.strictEqual(actualToken, mockErc20.address)
      assert.equal(actualLockDuration, INITIAL_LOCK_DURATION)
      assert.equal(actualLockAmount, INITIAL_LOCK_AMOUNT.toString())
      assert.equal(
        actualSpamPenaltyFactor,
        INITIAL_SPAM_PENALTY_FACTOR.toString()
      )
      assert.isTrue(hasInitialized)
    })

    it('checks it is a forwarder', async () => {
      assert.isTrue(await timeLockForwarder.isForwarder())
    })

    it('checks account can forward actions', async () => {
      await daoDeployment.acl.createPermission(
        rootAccount,
        timeLockForwarder.address,
        LOCK_TOKENS_ROLE,
        rootAccount
      )
      assert.isTrue(await timeLockForwarder.canForward(rootAccount, '0x'))
    })

    it('cannot forward if account not permitted to lock tokens ', async () => {
      assert.isFalse(await timeLockForwarder.canForward(rootAccount, '0x'))
    })

    describe('changeLockDuration(uint256 _lockDuration)', () => {
      it('sets a new lock duration', async () => {
        await daoDeployment.acl.createPermission(
          rootAccount,
          timeLockForwarder.address,
          CHANGE_DURATION_ROLE,
          rootAccount
        )
        const expectedLockDuration = 120

        await timeLockForwarder.changeLockDuration(expectedLockDuration)

        const actualLockDuration = await timeLockForwarder.lockDuration()
        assert.equal(actualLockDuration, expectedLockDuration)
      })
    })

    describe('changeLockAmount(uint256 _lockAmount)', () => {
      it('sets a new lock amount', async () => {
        await daoDeployment.acl.createPermission(
          rootAccount,
          timeLockForwarder.address,
          CHANGE_AMOUNT_ROLE,
          rootAccount
        )
        const expectedLockAmount = bigExp(20, decimals)

        await timeLockForwarder.changeLockAmount(expectedLockAmount)

        const actualLockAmount = await timeLockForwarder.lockAmount()
        assert.equal(actualLockAmount, expectedLockAmount.toString())
      })
    })

    describe('changeSpamPenaltyFactor(uint256 _spamPenaltyFactor)', () => {
      it('sets a new spam penalty factor', async () => {
        await daoDeployment.acl.createPermission(
          rootAccount,
          timeLockForwarder.address,
          CHANGE_SPAM_PENALTY_ROLE,
          rootAccount
        )
        const expectedSpamPenaltyFactor = pct16(100)

        await timeLockForwarder.changeSpamPenaltyFactor(
          expectedSpamPenaltyFactor
        )

        const actualSpamPenaltyFactor = await timeLockForwarder.spamPenaltyFactor()
        assert.equal(
          actualSpamPenaltyFactor,
          expectedSpamPenaltyFactor.toString()
        )
      })
    })

    describe('forwardFee()', async () => {
      it("get's forwarding fee information", async () => {
        const [actualToken, actualLockAmount] = Object.values(
          await timeLockForwarder.forwardFee()
        )

        assert.strictEqual(actualToken, mockErc20.address)
        assert.equal(actualLockAmount, INITIAL_LOCK_AMOUNT.toString())
      })

      context('account has 1 active lock', async () => {
        beforeEach(async () => {
          const executionTarget = await ExecutionTarget.new()
          const action = {
            to: executionTarget.address,
            calldata: executionTarget.contract.methods.execute().encodeABI(),
          }
          const script = encodeCallScript([action])
          await daoDeployment.acl.createPermission(
            rootAccount,
            timeLockForwarder.address,
            LOCK_TOKENS_ROLE,
            rootAccount
          )
          await mockErc20.approve(
            timeLockForwarder.address,
            INITIAL_LOCK_AMOUNT,
            {
              from: rootAccount,
            }
          )
          await timeLockForwarder.forward(script, { from: rootAccount })
        })

        it('forward fee increases for second lock', async () => {
          const [_, actualLockAmount] = Object.values(
            await timeLockForwarder.forwardFee({ from: rootAccount })
          )
          assert.equal(actualLockAmount, bigExp(15, decimals).toString())
        })

        it('forward fee increases when increasing spam penalty factor', async () => {
          await daoDeployment.acl.createPermission(
            rootAccount,
            timeLockForwarder.address,
            CHANGE_SPAM_PENALTY_ROLE,
            rootAccount
          )
          await timeLockForwarder.changeSpamPenaltyFactor(pct16(100))
          const [_, actualLockAmount] = Object.values(
            await timeLockForwarder.forwardFee({ from: rootAccount })
          )

          assert.equal(actualLockAmount, bigExp(20, decimals).toString())
        })
      })
    })

    describe('getSpamPenalty()', () => {
      it("get's spam penalty amount and duration", async () => {
        const [
          actualSpamPenaltyAmount,
          actualSpamPenaltyDuration,
        ] = Object.values(
          await timeLockForwarder.getSpamPenalty({ from: rootAccount })
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
          await daoDeployment.acl.createPermission(
            rootAccount,
            timeLockForwarder.address,
            LOCK_TOKENS_ROLE,
            rootAccount
          )
          await mockErc20.approve(
            timeLockForwarder.address,
            INITIAL_LOCK_AMOUNT,
            {
              from: rootAccount,
            }
          )
          await timeLockForwarder.forward(script, { from: rootAccount })
        })

        it('spam penalty amount and duration increase for second lock', async () => {
          const [
            actualSpamPenaltyAmount,
            actualSpamPenaltyDuration,
          ] = Object.values(
            await timeLockForwarder.getSpamPenalty({ from: rootAccount })
          )

          assert.equal(actualSpamPenaltyAmount, bigExp(5, decimals).toString())
          assert.equal(actualSpamPenaltyDuration, 30)
        })

        it('spam penalty amount and duration increase when increasing spam penalty factor', async () => {
          await daoDeployment.acl.createPermission(
            rootAccount,
            timeLockForwarder.address,
            CHANGE_SPAM_PENALTY_ROLE,
            rootAccount
          )
          await timeLockForwarder.changeSpamPenaltyFactor(pct16(100))

          const [
            actualSpamPenaltyAmount,
            actualSpamPenaltyDuration,
          ] = Object.values(
            await timeLockForwarder.getSpamPenalty({ from: rootAccount })
          )

          assert.equal(actualSpamPenaltyAmount, bigExp(10, decimals).toString())
          assert.equal(actualSpamPenaltyDuration, 60)
        })
      })
    })

    describe('forward(bytes _evmCallScript)', async () => {
      let executionTarget, script
      let addressLocks = 0

      beforeEach('create execution script', async () => {
        await daoDeployment.acl.createPermission(
          rootAccount,
          timeLockForwarder.address,
          LOCK_TOKENS_ROLE,
          rootAccount
        )

        //create script
        executionTarget = await ExecutionTarget.new()
        const action = {
          to: executionTarget.address,
          calldata: executionTarget.contract.methods.execute().encodeABI(),
        }
        script = encodeCallScript([action])
      })

      it('forwards action successfully', async () => {
        await mockErc20.approve(
          timeLockForwarder.address,
          INITIAL_LOCK_AMOUNT,
          {
            from: rootAccount,
          }
        )

        const expectedCounter = 1
        const expectedLockerBalance = MOCK_TOKEN_BALANCE.sub(
          INITIAL_LOCK_AMOUNT
        )
        const expectedLockAppBalance = INITIAL_LOCK_AMOUNT
        const expectedNumberOfLocks = addressLocks + 1
        const expectedLockAmount = INITIAL_LOCK_AMOUNT

        await timeLockForwarder.forward(script, { from: rootAccount })

        const actualCounter = await executionTarget.counter()
        const actualLockerBalance = await mockErc20.balanceOf(rootAccount)
        const actualLockAppBalance = await mockErc20.balanceOf(
          timeLockForwarder.address
        )
        const actualNumberOfLocks = await timeLockForwarder.getWithdrawLocksCount(
          rootAccount
        )
        const {
          lockAmount: actualLockAmount,
        } = await timeLockForwarder.addressesWithdrawLocks(rootAccount, 0)

        //forwarded successfully
        assert.equal(actualCounter, expectedCounter)

        //transfered tokens successfully
        assert.equal(actualLockerBalance, expectedLockerBalance.toString())
        assert.equal(actualLockAppBalance, expectedLockAppBalance.toString())

        //lock created successfully
        assert.equal(actualNumberOfLocks, expectedNumberOfLocks)
        assert.equal(actualLockAmount, expectedLockAmount.toString())
      })

      it('cannot forward if sender does not approve lock app to transfer tokens', async () => {
        await assertRevert(
          timeLockForwarder.forward(script, { from: rootAccount }),
          'LOCK_TRANSFER_REVERTED'
        )
      })

      context('account has 1 active lock', async () => {
        beforeEach(async () => {
          await mockErc20.approve(
            timeLockForwarder.address,
            INITIAL_LOCK_AMOUNT,
            {
              from: rootAccount,
            }
          )
          await timeLockForwarder.forward(script, { from: rootAccount })
        })

        it('lock amount increases for second lock', async () => {
          const expectedLockAmount = bigExp(15, decimals)

          await mockErc20.approve(
            timeLockForwarder.address,
            expectedLockAmount,
            {
              from: rootAccount,
            }
          )
          await timeLockForwarder.forward(script, { from: rootAccount })

          const {
            lockAmount: actualLockAmount,
          } = await timeLockForwarder.addressesWithdrawLocks(rootAccount, 1)
          assert.equal(actualLockAmount, expectedLockAmount.toString())
        })

        it('lock amount increases when increasing spam penalty factor', async () => {
          await daoDeployment.acl.createPermission(
            rootAccount,
            timeLockForwarder.address,
            CHANGE_SPAM_PENALTY_ROLE,
            rootAccount
          )
          await timeLockForwarder.changeSpamPenaltyFactor(pct16(100))
          const expectedLockAmount = bigExp(20, decimals)

          await mockErc20.approve(
            timeLockForwarder.address,
            expectedLockAmount,
            {
              from: rootAccount,
            }
          )
          await timeLockForwarder.forward(script, { from: rootAccount })

          const {
            lockAmount: actualLockAmount,
          } = await timeLockForwarder.addressesWithdrawLocks(rootAccount, 1)
          assert.equal(actualLockAmount, expectedLockAmount.toString())
        })
      })

      describe('withdrawTokens()', async () => {
        let lockCount = 3

        beforeEach('Forward actions', async () => {
          await mockErc20.approve(
            timeLockForwarder.address,
            INITIAL_LOCK_AMOUNT.mul(bigExp(10)),
            {
              //approve more than required
              from: rootAccount,
            }
          )

          for (let i = 0; i < lockCount; i++) {
            await timeLockForwarder.forward(script, { from: rootAccount })
          }
        })

        it("doesn't withdraw tokens before lock duration has elapsed", async () => {
          const expectedLockCount = lockCount

          await timeLockForwarder.withdrawTokens(lockCount, {
            from: rootAccount,
          })

          const actualLockCount = await timeLockForwarder.getWithdrawLocksCount(
            rootAccount
          )
          assert.equal(actualLockCount, expectedLockCount)
        })

        it("can't withdraw more than locked", async () => {
          await assertRevert(
            timeLockForwarder.withdrawTokens(lockCount + 1),
            'LOCK_TOO_MANY_WITHDRAW_LOCKS'
          )
        })

        it('withdraws 1 locked token', async () => {
          const locksToWithdraw = 1
          const addressPrevBalance = await mockErc20.balanceOf(rootAccount)

          const expectedLockCount = lockCount - locksToWithdraw
          const expectedBalance = addressPrevBalance.add(
            INITIAL_LOCK_AMOUNT.mul(bigExp(locksToWithdraw))
          )

          //increase time
          await timeLockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)
          await timeLockForwarder.withdrawTokens(locksToWithdraw, {
            from: rootAccount,
          })

          const actualLockCount = await timeLockForwarder.getWithdrawLocksCount(
            rootAccount
          )
          const actualBalance = await mockErc20.balanceOf(rootAccount)
          assert.equal(actualLockCount, expectedLockCount)
          assert.equal(actualBalance, expectedBalance.toString())
        })

        //Having issue when calling withdrawTokens() (Invalid number of arguments in Solidity function)
        it(`withdraws all locked tokens (${lockCount})`, async () => {
          const expectedLockCount = 0

          //increase time
          await timeLockForwarder.mockIncreaseTime(
            INITIAL_LOCK_DURATION * lockCount + 1
          )
          await timeLockForwarder.withdrawAllTokens()

          const actualLockCount = await timeLockForwarder.getWithdrawLocksCount(
            rootAccount
          )
          assert.equal(actualLockCount, expectedLockCount)
        })

        describe('change lock duration', async () => {
          beforeEach(async () => {
            await daoDeployment.acl.createPermission(
              rootAccount,
              timeLockForwarder.address,
              CHANGE_DURATION_ROLE,
              rootAccount
            )
          })

          it("does not change current locks's unlockTime", async () => {
            const locksToWithdraw = 1
            const newLockDuration = 120

            const expectedLockCount = lockCount - locksToWithdraw

            await timeLockForwarder.changeLockDuration(newLockDuration)
            //current locks's unlockTime is 60
            await timeLockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)
            await timeLockForwarder.withdrawTokens(locksToWithdraw, {
              from: rootAccount,
            })

            const actualLockCount = await timeLockForwarder.getWithdrawLocksCount(
              rootAccount
            )
            assert.equal(actualLockCount, expectedLockCount)
          })
        })

        describe('change lock amount', async () => {
          beforeEach(async () => {
            await daoDeployment.acl.createPermission(
              rootAccount,
              timeLockForwarder.address,
              CHANGE_AMOUNT_ROLE,
              rootAccount
            )
          })

          it("does not change current locks's lockAmount", async () => {
            const locksToWithdraw = 1
            const previousBalance = await mockErc20.balanceOf(rootAccount)
            const newLockAmount = bigExp(20, decimals)

            const expectedBalance = previousBalance.add(INITIAL_LOCK_AMOUNT)

            await timeLockForwarder.changeLockAmount(newLockAmount)
            //current locks's lockAmount is 10
            await timeLockForwarder.mockIncreaseTime(INITIAL_LOCK_DURATION + 1)
            await timeLockForwarder.withdrawTokens(locksToWithdraw, {
              from: rootAccount,
            })

            const actualBalance = await mockErc20.balanceOf(rootAccount)
            assert.equal(actualBalance, expectedBalance.toString())
          })
        })
      })
    })
  })

  describe('app not initialized', () => {
    it('reverts on forwarding', async () => {
      await assertRevert(
        timeLockForwarder.forward('0x', { from: rootAccount }),
        'LOCK_CAN_NOT_FORWARD'
      )
    })

    it('reverts on changing duration', async () => {
      await assertRevert(
        timeLockForwarder.changeLockDuration(20),
        'APP_AUTH_FAILED'
      )
    })

    it('reverts on changing amount', async () => {
      await assertRevert(
        timeLockForwarder.changeLockAmount(10),
        'APP_AUTH_FAILED'
      )
    })

    it('reverts on changing spam penalty factor', async () => {
      await assertRevert(
        timeLockForwarder.changeSpamPenaltyFactor(10),
        'APP_AUTH_FAILED'
      )
    })

    it('reverts on withdrawing tokens', async () => {
      await assertRevert(timeLockForwarder.withdrawTokens())
    })
  })
})
