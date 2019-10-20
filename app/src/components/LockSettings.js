import React from 'react'
import styled from 'styled-components'

import { Text, TokenBadge } from '@aragon/ui'
import { formatTokenAmount, formatTime, round } from '../lib/math-utils'

function LockSettings({
  duration,
  amount,
  spamPenaltyFactor,
  tokenAddress,
  tokenName,
  tokenSymbol,
  tokenDecimals,
  network,
  theme,
}) {
  return (
    <ul>
      {[
        ['Duration', <Text>{formatTime(Math.round(duration / 1000))}</Text>],
        [
          'Amount',
          <Text>{`${formatTokenAmount(amount, false, tokenDecimals)} ${tokenSymbol}`}</Text>,
        ],
        [
          'Token',
          <TokenBadge
            address={tokenAddress}
            name={tokenName}
            symbol={tokenSymbol}
            networkType={network.type}
          />,
        ],
        ['Span penalty', <Text>{`${round(spamPenaltyFactor * 100)} %`}</Text>],
      ].map(([label, content], index) => {
        return (
          <Row key={index}>
            <span
              css={`
                color: ${theme.surfaceContentSecondary};
              `}
            >
              {label}
            </span>
            {content}
          </Row>
        )
      })}
    </ul>
  )
}

const Row = styled.li`
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
  list-style: none;
`

export default LockSettings
