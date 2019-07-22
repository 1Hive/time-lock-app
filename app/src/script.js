import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { of } from 'rxjs'
import AragonApi from '@aragon/api'

import tokenAbi from './abi/token.json'
const INITIALIZATION_TRIGGER = Symbol('INITIALIZATION_TRIGGER')
const ACCOUNTS_TRIGGER = Symbol('ACCOUNTS_TRIGGER')

const api = new AragonApi()

api.indentify('Lock')

api
  .call('token')
  .subscribe(initialize, error =>
    console.error('Could not start background script execution due to the contract not loading token')
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

  return api.store(
    async (state, event) => {
      let nextState = {
        ...state,
      }

      if (eventName === INITIALIZATION_TRIGGER) {
        nextState = await initializeState(nextState, settings)
      } else if (eventName === ACCOUNTS_TRIGGER) {
        nextState = await updateConnectedAccount(nextState, event, settings)
      }

      switch (eventName) {
        case 'ChangeLockDuration':
          nextState = await addedToken(nextState, event, settings)
          break
        case 'ChangeLockAmount':
          nextState = await removedToken(nextState, event)
          break
        case 'Withdrawal':
          nextState = await newRedemption(nextState, settings)
          break
        default:
          break
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

async function initializeState(state, { token }) {
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
