import React from 'react'
import styled from 'styled-components'

import { Text, Box, IconAttention, useTheme, GU } from '@aragon/ui'
import { useNetwork } from '@aragon/api-react'

import LockSettings from './LockSettings'
import { InfoAlert } from './Message'

const InfoBoxes = React.memo(props => {
  const { theme } = props
  console.log(theme)
  return (
    <>
      <Box heading="Lock info">
        <LockSettings {...props} />
      </Box>

      <InfoAlert
        text={
          <Wrap>
            {' '}
            <IconAttention
              css={`
                margin-right: ${GU}px;
              `}
            />{' '}
            <span>You can withdraw your tokens once they unlock</span>
          </Wrap>
        }
      />
    </>
  )
})

const Wrap = styled.div`
  display: flex;
`

export default props => {
  const network = useNetwork()
  const theme = useTheme()
  return <InfoBoxes {...props} network={network} theme={theme} />
}
