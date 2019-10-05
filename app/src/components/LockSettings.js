import React from 'react'
import styled from 'styled-components'

import { TokenBadge, Text, theme, Box, IconAttention } from '@aragon/ui'
import { useNetwork } from '@aragon/api-react'
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
}) {
  return (
    <>
      <Box heading="Lock info">
        <ul>
          <InfoRow>
            <Text>Duration</Text>
            <Duration>{formatTime(Math.round(duration / 1000))}</Duration>
          </InfoRow>
          <InfoRow>
            <Text>Amount</Text>
            <Text>{`${formatTokenAmount(amount, false, tokenDecimals)} ${tokenSymbol}`}</Text>
          </InfoRow>
          <InfoRow>
            <Text>Token</Text>
            {network && tokenSymbol && (
              <TokenBadge address={tokenAddress} name={tokenName} symbol={tokenSymbol} networkType={network.type} />
            )}
          </InfoRow>
          <InfoRow>
            <Text>Spam penalty</Text>
            <Text>{round(spamPenaltyFactor * 100)} %</Text>
          </InfoRow>
        </ul>
      </Box>
      <Box header="info" css={{ backgroundColor: theme.infoBackground }}>
        <Wrap>
          <IconAttention style={{ marginRight: '6px' }} />
          <Text color={theme.infoSurfaceContent}>You can withdraw your tokens once they unlock</Text>
        </Wrap>
      </Box>
    </>
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

const Wrap = styled.div`
  display: flex;
`

export default props => {
  const network = useNetwork()
  return <LockSettings network={network} {...props} />
}
