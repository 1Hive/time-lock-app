import BN from 'bn.js'

export function isUnlocked(unlockTime, now) {
  return unlockTime <= now
}

export function reduceTotal(locks) {
  return locks.reduce((acc, lock) => acc.add(lock.lockAmount), new BN(0))
}
//TODO: convert time to seconds in script, check for loaded settings ,
