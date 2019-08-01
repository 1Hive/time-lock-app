import React from 'react'
import { Info, Text, IconCross, theme } from '@aragon/ui'
import styled from 'styled-components'

const Message = styled.div`
  margin-top: 1rem;
`

export const InfoMessage = ({ title, text }) => {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <Info.Action title={title} background={theme.infoBackground}>
        {text}
      </Info.Action>
    </div>
  )
}

export const ErrorMessage = ({ message }) => (
  <Message>
    <p>
      <IconCross />
      <Text size="small" style={{ marginLeft: '10px' }}>
        {message}
      </Text>
    </p>
  </Message>
)
