import React from 'react'
import styled from 'styled-components'

import { TokenBadge, Text, breakpoint, theme, Box } from '@aragon/ui'
import { useNetwork } from '@aragon/api-react'
import { formatTokenAmount, formatTime } from '../lib/math-utils'

function LockSettings({ token, duration, amount, network }) {
  return (
    <Box heading="Lock info">
      <ul>
        <InfoRow>
          <Text>Duration</Text>
          <Duration>{formatTime(duration)}</Duration>
        </InfoRow>
        <InfoRow>
          <Text>Amount</Text>
          <Text>{`${formatTokenAmount(amount, false, token.decimals)} ${
            token.symbol
          }`}</Text>
        </InfoRow>
        <InfoRow>
          <Text>Token</Text>
          <TokenBadge
            address={token.address}
            name={token.name}
            symbol={token.symbol}
            networkType={network.type}
          />
        </InfoRow>
      </ul>
    </Box>
  )
}

const InfoRow = styled.li`
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
  list-style: none;

  > span:nth-child(1) {
    font-weight: 400;
    color: ${theme.textSecondary};
  }
`

const Duration = styled.div`
  display: flex;
  align-items: center;
`

export default props => {
  const network = useNetwork()
  return <LockSettings network={network} {...props} />
}
