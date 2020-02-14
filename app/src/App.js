import React from 'react'
import { Header, Main, SidePanel, SyncIndicator, Tag } from '@aragon/ui'
import { useAragonApi } from '@aragon/api-react'

import Locks from './screens/Locks'
import MainButton from './components/MainButton'
import Title from './components/Title'
import WithdrawLocks from './components/Panels/WithdrawLocks'
import { useAppLogic } from './hooks/app-hooks'

import Icon from './assets/withdraw.svg'

function App() {
  const { locks, panelState, isSyncing, tokenSymbol, actions } = useAppLogic()
  const { guiStyle } = useAragonApi()
  const { appearance } = guiStyle

  return (
    <Main theme={appearance}>
      <SyncIndicator visible={isSyncing} />
      <Header
        primary={<Title text="Time Lock" after={tokenSymbol && <Tag>{tokenSymbol}</Tag>} />}
        secondary={
          !!locks.length && (
            <MainButton
              label="Withdraw"
              onClick={panelState.requestOpen}
              icon={<img src={Icon} height="22px" alt="" />}
            />
          )
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
  )
}

export default App
