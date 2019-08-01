import React from 'react'
import styled from 'styled-components'
import { useAragonApi } from '@aragon/api-react'
import { font } from '@aragon/ui'
import MenuButton from './MenuButton/MenuButton'

function Title({ text, after }) {
  const { requestMenu, displayMenuButton } = useAragonApi()

  console.log('menubutton', displayMenuButton)
  return (
    <Wrapper>
      {displayMenuButton && <MenuButton onClick={requestMenu} />}
      <Label
        css={`
          margin-left: ${displayMenuButton ? '20' : '0'};
        `}
      >
        {text}
      </Label>
      {after}
    </Wrapper>
  )
}

const Wrapper = styled.h1`
  display: flex;
  flex: 1 1 auto;
  width: 0;
  align-items: center;
  height: 100%;
`

const Label = styled.span`
  flex: 0 1 auto;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 10px;
  ${font({ size: 'xxlarge' })};
`

export default Title
