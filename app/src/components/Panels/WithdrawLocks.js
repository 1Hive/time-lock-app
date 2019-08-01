import React from 'react'
import { Button } from '@aragon/ui'
import { InfoMessage } from '../Message'

function WithdrawLocks({}) {
  const handleFormSubmit = e => {
    e.preventDefault()
    console.log('submit')
  }

  return (
    <form onSubmit={handleFormSubmit}>
      <InfoMessage
        title={'Lock action'}
        text={`This action will withdraw ?? locks`}
      />
      <Button type="submit" mode="strong" wide={true}>
        Withdraw
      </Button>
    </form>
  )
}

export default WithdrawLocks
