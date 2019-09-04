import React from 'react'
import PropTypes from 'prop-types'
import { Split, Box } from '@aragon/ui'
import { useAppState } from '@aragon/api-react'
import styled from 'styled-components'

import LockTable from '../components/LockTable'
import LockSettings from '../components/LockSettings'

function Locks({ locks }) {
  const {
    lockAmount,
    lockDuration,
    griefingFactor,
    tokenAddress,
    tokenName,
    tokenSymbol,
    tokenDecimals,
  } = useAppState()

  console.log('grief', griefingFactor)

  return (
    <Split
      primary={<LockTable locks={locks} tokenSymbol={tokenSymbol} tokenDecimals={tokenDecimals} />}
      secondary={
        <LockSettings
          amount={lockAmount}
          duration={lockDuration}
          griefingFactor={griefingFactor}
          tokenName={tokenName}
          tokenAddress={tokenAddress}
          tokenSymbol={tokenSymbol}
          tokenDecimals={tokenDecimals}
        />
      }
    />
  )
}

export default Locks
