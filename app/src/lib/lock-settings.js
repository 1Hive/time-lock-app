// contract getter | variableName | data type
const lockSettings = [
  ['token', 'tokenAddress'],
  ['lockDuration', 'lockDuration', 'time'],
  ['lockAmount', 'lockAmount', 'bignumber'],
  ['griefingFactor', 'griefingFactor', 'number'],
]

export function hasLoadedLockSettings(state) {
  state = state || {}
  return lockSettings.reduce((loaded, [_, key]) => loaded && !!state[key], true)
}

export default lockSettings
