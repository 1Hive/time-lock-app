import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import styled from 'styled-components'
import { Button, TextInput, Text, Field, theme } from '@aragon/ui'
import { reduceTotal } from '../../lib/lock-utils'
import { formatTokenAmount } from '../../lib/math-utils'
import { InfoMessage } from '../Message'
import { useAppState } from '@aragon/api-react'

function WithdrawLocks({ locks, withdraw, panelOpened }) {
  const { tokenSymbol, tokenDecimals } = useAppState()
  const unlocked = locks.filter(l => l.unlocked)

  const initialState = useMemo(() => ({ value: '0', max: unlocked.length }), [
    unlocked.length,
  ])

  const [count, handleCountChange] = useCount(initialState, unlocked)

  const refund = reduceTotal(unlocked.slice(0, count.value))
  const inputRef = useRef(null)

  useEffect(() => {
    if (panelOpened) inputRef.current.focus()
    else handleCountChange(initialState.value)
  }, [panelOpened, initialState])

  const handleFormSubmit = useCallback(
    e => {
      e.preventDefault()
      withdraw(count.value)
    },
    [withdraw, count]
  )

  return (
    <form onSubmit={handleFormSubmit}>
      <InfoMessage
        title={'Lock action'}
        text={`This action will withdraw the ${
          count.value == 1 ? '' : count.value
        } oldest lock${count.value == 1 ? '' : 's'}`}
      />
      <Row>
        <Split border={String(theme.accent)}>
          <h2>
            <Text smallcaps>Total locks</Text>
          </h2>

          <Text weight={'bold'}>
            {count.max} Lock{count.max === 1 ? '' : 's'}
          </Text>
        </Split>
        <Split>
          <h2>
            <Text smallcaps>Tokens back</Text>
          </h2>

          <Text weight={'bold'}>
            {`${formatTokenAmount(
              refund,
              false,
              tokenDecimals
            )} ${tokenSymbol}`}{' '}
          </Text>
        </Split>
      </Row>
      <Row>
        <Field label="Withdraw" style={{ width: '100%' }}>
          <Input
            name="count"
            wide={true}
            value={count.value}
            max={count.max}
            min={'1'}
            step={'1'}
            onChange={handleCountChange}
            required
            ref={inputRef}
          />
        </Field>
        <MaxInput onClick={() => handleCountChange(count.max)}>Max</MaxInput>
      </Row>
      <Button type="submit" mode="strong" wide={true} disabled={count.max <= 0}>
        Withdraw
      </Button>
    </form>
  )
}

function useCount(init, unlocked) {
  const [count, setCount] = useState(init)

  useEffect(() => {
    setCount({ ...count, max: unlocked.length })
  }, [unlocked])

  //we use only one function for all cases the count can change
  const handleCountChange = useCallback(
    e => {
      const value = e.target ? e.target.value : e
      if (value <= count.max) setCount({ ...count, value })
    },
    [count]
  )

  return [count, handleCountChange]
}

const Row = styled.div`
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
`

const Split = styled.div`
  flex-basis: 50%;
  padding: 20px;
  text-align: center;

  &:first-child {
    border-right: 2px solid ${theme.accent};
  }
`

const Input = styled(TextInput.Number)`
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: 0;
`

const MaxInput = styled.span`
  padding: 9px;
  background-color: #1ccde3;
  cursor: pointer;
  color: #ffffff;
  border-top-right-radius: 3px;
  border-bottom-right-radius: 3px;
  width: 108px;
  text-align: center;
  box-shadow: 0px 0px 3px 0px #3ce6e0;
  transition: background-color 0.5s ease;

  &:hover {
    background-color: #58d1e0;
  }

  &:active {
    box-shadow: none;
  }
`

export default WithdrawLocks
