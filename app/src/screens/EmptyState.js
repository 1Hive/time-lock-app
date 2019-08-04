import React from 'react'
import styled from 'styled-components'
import { Text, useTheme, Box } from '@aragon/ui'
import emptyIcon from '../assets/lock.svg'

const EmptyState = () => {
  const theme = useTheme()

  return (
    <Box style={{ textAlign: 'center' }}>
      {/* <BackgroundIcon>
          <img src={emptyIcon} alt="" height="70x" />
        </BackgroundIcon> */}
      <Text>No tokens locked</Text>
    </Box>
  )
}

const Main = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 20px 0;
`

const BackgroundIcon = styled.div`
  border-radius: 50%;
  background: linear-gradient(to left, #f9fafc, #f9fafc);
  padding: 10px;
  margin: 15px auto;
`

export default EmptyState
