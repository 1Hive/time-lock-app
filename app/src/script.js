import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { map, publishReplay } from 'rxjs/operators'
import { of } from 'rxjs'
import AragonApi from '@aragon/api'

import { addressesEqual } from './lib/web3-utils'
import tokenAbi from './abi/token.json'

const INITIALIZATION_TRIGGER = Symbol('INITIALIZATION_TRIGGER')
const ACCOUNTS_TRIGGER = Symbol('ACCOUNTS_TRIGGER')

const api = new AragonApi()

api.indentify('Lock')

api
  .call('token')
  .subscribe(initialize, err =>
    console.error(`Could not start background script execution due to the contract not loading token: ${err}`)
  )

async function initialize(tokenAddress) {
  const tokenContract = api.external(tokenAddress, tokenAbi)

  return createStore({
    token: {
      address: tokenAddress,
      contract: tokenContract,
    },
  })
}

async function createStore(settings) {
  // Hot observable which emits an web3.js event-like object with an account string of the current active account.
  const accounts$ = api.accounts().pipe(
    map(accounts => {
      return {
        event: ACCOUNTS_TRIGGER,
        account: accounts[0],
      }
    }),
    publishReplay(1)
  )

  accounts$.connect()

  const currentBlock = await getBlockNumber()

  return api.store(
    async (state, event) => {
      const { event: eventName, blockNumber } = event

      console.log('event', event)
      //dont want to listen for past events for now
      //(our app state can be obtained from smart contract vars)
      if (blockNumber && blockNumber <= currentBlock) return state

      let nextState = {
        ...state,
      }

      if (eventName === INITIALIZATION_TRIGGER) {
        nextState = await initializeState(nextState, settings)
      } else if (eventName === ACCOUNTS_TRIGGER) {
        nextState = await updateConnectedAccount(nextState, event)
      } else {
        switch (eventName) {
          case 'ChangeLockDuration':
            nextState = await updateLockDuration(nextState, event)
            break
          case 'ChangeLockAmount':
            nextState = await updateLockAmount(nextState, event)
            break
          case 'NewLock':
            nextState = await newLock(nextState, event)
          case 'Withdrawal':
            nextState = await newWithdrawal(nextState, event)
            break
          default:
            break
        }
      }

      return nextState
    },
    [
      // Always initialize the store with our own home-made event
      of({ event: INITIALIZATION_TRIGGER }),
      accounts$,
    ]
  )
}

/***********************
 *                     *
 *   Event Handlers    *
 *                     *
 ***********************/

async function initializeState(state, settings) {
  return {
    ...state,
    token: await getTokenData(settings),
  }
}

async function updateConnectedAccount(state, { account }) {
  const lockCount = await api.call('getWithdrawLocksCount', account).toPromise()
  const locks = []

  for (let i = 0; i < lockCount; i++) {
    let { unlockTime, lockAmount } = await api.call('addressesWithdrawLocks', account, i).toPromise()
    locks.push({ unlockTime, lockAmount })
  }

  return {
    ...state,
    locks,
    account,
  }
}

async function updateLockDuration(state, { returnValues: { newLockDuration } }) {
  return {
    ...state,
    lockDuration: newLockDuration,
  }
}

async function updateLockAmount(state, { returnValues: { newLockAmount } }) {
  return {
    ...state,
    lockAmount: newLockAmount,
  }
}

async function newLock(state, { returnValues }) {
  const { lockAddress, unlockTime, lockAmount } = returnValues
  const { account, locks } = state

  //skip if no connected account or new lock doesn't correspond to connected account
  if (!(account && addressesEqual(lockAddress, account))) return state

  return {
    ...state,
    locks: [...locks, { unlockTime, lockAmount }],
  }
}

async function newWithdrawal(state, { returnValues }) {
  const { withdrawalAddress, withdrawalLockCount } = returnValues
  const { account, locks } = state

  //skip if no connected account or new withdrawl doesn't correspond to connected account
  if (!(account && addressesEqual(withdrawalAddress, account))) return state

  return {
    ...state,
    locks: locks.slice(withdrawalLockCount),
  }
}

/***********************
 *                     *
 *       Helpers       *
 *                     *
 ***********************/

async function getTokenData({ token }) {
  //TODO: check for contracts that use bytes32 as symbol() reutrn value (same for name)
  const { contract } = token
  const [name, symbol, decimals] = await Promise.all([
    contract.name().toPromise(),
    contract.symbol().toPromise(),
    contract.decimals().toPromise(),
  ])

  return {
    name,
    symbol,
    decimals,
  }
}

function getBlockNumber() {
  return new Promise((resolve, reject) => api.web3Eth('getBlockNumber').subscribe(resolve, reject))
}
