import React from 'react'
import styled from 'styled-components'
import { DataView, Text, Countdown, Box, useTheme, breakpoint, useViewport } from '@aragon/ui'
import { formatTokenAmount, toHours } from '../lib/math-utils'
import { reduceTotal } from '../lib/lock-utils'
import EmptyState from '../screens/EmptyState'

const PAGINATION = 10

function LockTable({ locks, tokenSymbol, tokenDecimals }) {
  const theme = useTheme()
  const { below } = useViewport()

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
      <BoxPad borderColor={String(theme.positive)} below={below} unlocked={totalUnlocked > 0}>
        <Wrap>
          <Text>Unlocked balance:</Text>
          {totalUnlocked > 0 ? (
            <Balance weight="bold" background={String(theme.positive)}>
              {formatTokenAmount(totalUnlocked, false, tokenDecimals)} {tokenSymbol}{' '}
            </Balance>
          ) : (
            <Text size="large" weight="bold">
              0 {tokenSymbol}
            </Text>
          )}
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
        />
      ) : (
        <EmptyState />
      )}
    </>
  )
}

const BoxPad = styled(Box)`
  > div {
    padding: 20px;
  }

  ${({ borderColor, below, unlocked }) =>
    below('medium') && unlocked
      ? `
    border-top: 2px solid ${borderColor};
    border-bottom: 2px solid ${borderColor};
    `
      : unlocked &&
        `
      border-left: 3px solid ${borderColor};
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      `}
`

const Balance = styled(Text)`
  color: white;
  background: ${({ background }) => background};
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 18px;
`

const Wrap = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

export default LockTable
