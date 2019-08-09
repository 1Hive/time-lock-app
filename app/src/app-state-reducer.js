import { hasLoadedLockSettings } from './lib/lock-settings'
import { BN } from 'bn.js'

function appStateReducer(state) {
  const ready = hasLoadedLockSettings(state)

  if (!ready) {
    return { ...state, ready }
  }

  const { locks, token } = state

  return {
    ...state,
    ready,
    locks: locks
      ? locks.map(lock => ({
          lockAmount: new BN(lock.lockAmount),
          unlockTime: new Date(lock.unlockTime),
        }))
      : [],
  }
}

export default appStateReducer
