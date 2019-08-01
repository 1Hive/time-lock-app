import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useAragonApi } from '@aragon/api-react'
import { Main, SidePanel, SyncIndicator, Badge, Header } from '@aragon/ui'

import Title from './components/Title'
import MainButton from './components/MainButton'
import Locks from './components/Locks'
import EmptyState from './screens/EmptyState'
import withdrawIcon from './assets/icono.svg'
import WithdrawLocks from './components/Panels/WithdrawLocks'

function App(props) {
  const [opened, setOpened] = useState(false)

  console.log('props', props)
  const { isSyncing, settings, locks } = props
  const { token } = settings || {}

  const showLocks = locks && locks.length > 0

  return (
    <Main>
      <SyncIndicator visible={isSyncing} />
      <Header
        primary={
          <Title
            text="Lock"
            after={token && <Badge.App>{token.symbol}</Badge.App>}
          />
        }
        secondary={
          showLocks ? (
            <MainButton
              label="Withdraw"
              onClick={() => setOpened(true)}
              icon={<img src={withdrawIcon} height="30px" alt="" />}
            />
          ) : null
        }
      />
      {showLocks ? (
        <Locks locks={locks} settings={settings} />
      ) : (
        !isSyncing && <EmptyState />
      )}
      <SidePanel
        opened={opened}
        onClose={() => setOpened(false)}
        title="Withdraw"
      >
        <WithdrawLocks />
      </SidePanel>
    </Main>
  )
}

export default () => {
  const { api, appState } = useAragonApi()
  return <App api={api} {...appState} />
}

App.propTypes = {
  api: PropTypes.object,
  appState: PropTypes.object,
}
