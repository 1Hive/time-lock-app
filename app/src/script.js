import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Aragon, { events } from '@aragon/api'
import { addressesEqual } from './lib/web3-utils'
import tokenAbi from './abi/token.json'
import retryEvery from './lib/retry-every'

const app = new Aragon()

retryEvery(() =>
  app
    .call('token')
    .subscribe(initialize, err =>
      console.error(
        `Could not start background script execution due to the contract not loading token: ${err}`
      )
    )
)

async function initialize(tokenAddress) {
  const tokenContract = app.external(tokenAddress, tokenAbi)
  console.log('contract', tokenContract)
  return createStore({ contract: tokenContract, address: tokenAddress })
}

async function createStore(tokenInstance) {
  const currentBlock = await getBlockNumber()

  return app.store(
    (state, { event, returnValues, blockNumber }) => {
      //dont want to listen for past events for now
      //(our app state can be obtained from smart contract vars)
      if (blockNumber && blockNumber <= currentBlock) return state

      let nextState = {
        ...state,
      }

      switch (event) {
        case events.ACCOUNTS_TRIGGER:
          return updateConnectedAccount(nextState, returnValues)
        case events.SYNC_STATUS_SYNCING:
          return { ...nextState, isSyncing: true }
        case events.SYNC_STATUS_SYNCED:
          return { ...nextState, isSyncing: false }
        case 'ChangeLockDuration':
          return updateLockDuration(nextState, returnValues)
        case 'ChangeLockAmount':
          return updateLockAmount(nextState, returnValues)
        case 'NewLock':
          return newLock(nextState, returnValues)
        case 'Withdrawal':
          return newWithdrawal(nextState, returnValues)
        default:
          return state
      }
    },
    {
      init: initializeState({}, tokenInstance),
    }
  )
}

/***********************
 *                     *
 *   Event Handlers    *
 *                     *
 ***********************/

function initializeState(state, tokenInstance) {
  return async cachedState => {
    let token = await getTokenData(tokenInstance)
    token && app.indentify(`Lock ${token.symbol}`)

    return {
      ...state,
      isSyncing: true,
      settings: { token, ...(await getLockSettings()) },
    }
  }
}

async function updateConnectedAccount(state, { account }) {
  const lockCount = await app.call('getWithdrawLocksCount', account).toPromise()
  const locks = []

  for (let i = 0; i < lockCount; i++) {
    let { unlockTime, lockAmount } = await app
      .call('addressesWithdrawLocks', account, i)
      .toPromise()
    locks.push({ unlockTime, lockAmount })
  }

  return {
    ...state,
    locks,
    account,
  }
}

async function updateLockDuration({ settings, ...state }, { newLockDuration }) {
  return {
    ...state,
    settings: { ...settings, duration: newLockDuration },
  }
}

async function updateLockAmount({ settings, ...state }, { newLockAmount }) {
  return {
    ...state,
    settings: { ...settings, amount: newLockAmount },
  }
}

async function newLock(state, { lockAddress, unlockTime, lockAmount }) {
  const { account, locks } = state

  //skip if no connected account or new lock doesn't correspond to connected account
  if (!(account && addressesEqual(lockAddress, account))) return state

  return {
    ...state,
    locks: [...locks, { unlockTime, lockAmount }],
  }
}

async function newWithdrawal(
  state,
  { withdrawalAddress, withdrawalLockCount }
) {
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

async function getTokenData({ contract, address }) {
  try {
    console.log('contract', contract)
    //TODO: check for contracts that use bytes32 as symbol() return value (same for name)
    const [name, symbol, decimals] = await Promise.all([
      contract.name().toPromise(),
      contract.symbol().toPromise(),
      contract.decimals().toPromise(),
    ])

    return {
      address,
      name,
      symbol,
      decimals,
    }
  } catch (err) {
    console.error('Error loading token data: ', err)
    return {}
  }
}

async function getLockSettings() {
  try {
    const [duration, amount] = await Promise.all([
      app.call('lockDuration').toPromise(),
      app.call('lockAmount').toPromise(),
    ])
    return {
      duration,
      amount,
    }
  } catch (err) {
    console.error('Error loading lock settings: ', err)
    return {}
  }
}

function getBlockNumber() {
  return new Promise((resolve, reject) =>
    app.web3Eth('getBlockNumber').subscribe(resolve, reject)
  )
}
