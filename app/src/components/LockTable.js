import React from 'react'
import styled from 'styled-components'
import { DataView, Text, Countdown, Box, useTheme } from '@aragon/ui'
import { formatTokenAmount, toHours } from '../lib/math-utils'
import { reduceTotal } from '../lib/lock-utils'
import EmptyState from '../screens/EmptyState'

const PAGINATION = 10

function LockTable({ locks, tokenSymbol, tokenDecimals }) {
  const theme = useTheme()

  const renderUnlockTime = unlockTime => {
    const now = new Date()
    const end = new Date(unlockTime)
    const removeDaysAndHours = toHours(end - now) < 1
    return <Countdown end={end} removeDaysAndHours={removeDaysAndHours} />
  }

  const unlocked = locks.filter(l => l.unlocked)
  const totalUnlocked = reduceTotal(unlocked)

  const locked = locks.filter(l => !unlocked.includes(l))
  const totalLocked = reduceTotal(locked)
  return (
    <>
      <BoxPad style={totalUnlocked > 0 ? { borderLeft: `3px solid ${theme.positive}` } : {}}>
        <Wrap>
          <Text>Unlocked balance:</Text>
          <Text size="large" weight="bold" color={totalUnlocked > 0 ? String(theme.positive) : ''}>
            {formatTokenAmount(totalUnlocked, false, tokenDecimals)} {tokenSymbol}{' '}
          </Text>
        </Wrap>
      </BoxPad>
      {locked.length > 0 ? (
        <DataView
          fields={['Amount', 'Unlocks in']}
          entries={locked.map(l => [l.lockAmount, l.unlockTime])}
          renderEntry={([amount, unlockTime]) => [
            <Text>{`${formatTokenAmount(amount, false, tokenDecimals)} ${tokenSymbol}`}</Text>,
            renderUnlockTime(unlockTime),
          ]}
          mode="table"
          entriesPerPage={PAGINATION}
          // onSelectEntries={selected => console.log('selected', selected)}
        />
      ) : (
        <EmptyState>No current tokens locked</EmptyState>
      )}
    </>
  )
}

const BoxPad = styled(Box)`
  > div {
    padding: 20px;
  }
`

const Wrap = styled.div`
  display: flex;
  justify-content: space-between;
`

export default LockTable
