import React from 'react'
import { Info } from '@aragon/ui'

export const InfoMessage = ({ title, text }) => {
  return (
    <div style={{ margin: '1rem 0' }}>
      <Info.Action title={title}>{text}</Info.Action>
    </div>
  )
}

export const InfoAlert = ({ title, text }) => {
  return (
    <div style={{ margin: '1rem 0' }}>
      <Info.Alert title={title}>{text}</Info.Alert>
    </div>
  )
}
