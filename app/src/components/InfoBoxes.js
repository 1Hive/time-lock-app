import React from 'react'

import { Box, useTheme } from '@aragon/ui'
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
      <InfoAlert text="You can withdraw your tokens once they unlock" />
    </>
  )
})

export default props => {
  const network = useNetwork()
  const theme = useTheme()
  return <InfoBoxes {...props} network={network} theme={theme} />
}
