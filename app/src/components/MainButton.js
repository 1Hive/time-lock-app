import React from 'react'
import styled from 'styled-components'
import { Button, ButtonIcon, useViewport } from '@aragon/ui'

function MainButton({ label, icon, onClick, below }) {
  return below('medium') ? (
    <Icon
      onClick={onClick}
      label={label}
      css={`
        width: auto;
        height: 100%;
        padding: 0 20px 0 10px;
        margin-left: 8px;
      `}
    >
      {icon}
    </Icon>
  ) : (
    <Button mode="strong" onClick={onClick}>
      {label}
    </Button>
  )
}

const Icon = styled(ButtonIcon)`
  padding: 0 !important;
`

export default props => {
  const { below } = useViewport()
  return <MainButton {...props} below={below} />
}
