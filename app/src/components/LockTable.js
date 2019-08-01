import React from 'react'
import styled from 'styled-components'
import { DataView, Text, theme, Countdown } from '@aragon/ui'

import { formatTokenAmount, toHours } from '../lib/math-utils'

export default function LockTable({ locks, token }) {
  function renderUnlockTime(time) {
    const now = new Date()
    const end = new Date(time * 1000)

    if (end <= now)
      return <Text style={{ color: theme.positive }}>Unlocked</Text>

    const removeDaysAndHours = toHours(end - now) < 1
    return <Countdown end={end} removeDaysAndHours={removeDaysAndHours} />
  }

  return (
    <DataView
      fields={['Amount', 'Unlocks in']}
      entries={locks.map(l => [l.lockAmount, l.unlockTime])}
      renderEntry={([amount, unlockTime]) => [
        <Text>
          {`${formatTokenAmount(amount, false, token.decimals)} ${
            token.symbol
          }`}
        </Text>,
        renderUnlockTime(unlockTime),
      ]}
      mode="table"
      entriesPerPage={5}
      // onSelectEntries={selected => console.log('selected', selected)}
    />
  )
}
