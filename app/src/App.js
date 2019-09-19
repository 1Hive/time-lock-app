import React, { useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { useAragonApi } from '@aragon/api-react'
import { Main, SidePanel, SyncIndicator, Header, Badge } from '@aragon/ui'

import Title from './components/Title'
import MainButton from './components/MainButton'
import Locks from './screens/Locks'
import withdrawIcon from './assets/icono.svg'
import WithdrawLocks from './components/Panels/WithdrawLocks'
import { useAppLogic } from './hooks/app-hooks'

function App() {
  const { locks, panelState, isSyncing, tokenSymbol, actions } = useAppLogic()

  return (
    <>
      <Main>
        <SyncIndicator visible={isSyncing} />
        <Header
          primary={<Title text="Lock" after={tokenSymbol && <Badge.App>{tokenSymbol}</Badge.App>} />}
          secondary={
            locks.length > 0 ? (
              <MainButton
                label="Withdraw"
                onClick={panelState.requestOpen}
                icon={<img src={withdrawIcon} height="30px" alt="" />}
              />
            ) : null
          }
        />

        {!isSyncing && <Locks locks={locks} />}
        <SidePanel
          title="Withdraw"
          opened={panelState.visible}
          onClose={panelState.requestClose}
          onTransitionEnd={panelState.endTransition}
        >
          <WithdrawLocks panelOpened={panelState.opened} locks={locks} withdraw={actions.withdraw} />
        </SidePanel>
      </Main>
    </>
  )
}

const TempHeader = styled.div`
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  height: 63px;
  display: flex;
  -webkit-box-pack: justify;
  justify-content: space-between;
  box-shadow: rgba(0, 0, 0, 0.05) 0px 2px 5px;
  background: rgb(255, 255, 255);
`

export default App

