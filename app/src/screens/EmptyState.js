import React from 'react'
import styled from 'styled-components'
import { Text, useTheme, Box } from '@aragon/ui'

const EmptyState = () => {
  const theme = useTheme()

  return (
    <Box style={{ textAlign: 'center' }}>
      <Text>No tokens locked</Text>
    </Box>
  )
}

export default EmptyState
