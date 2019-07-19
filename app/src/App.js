import React from 'react'
import PropTypes from 'prop-types'
import { useAragonApi } from '@aragon/api-react'
import { Main, SidePanel } from '@aragon/ui'

import AppLayout from './components/AppLayout'
import EmptyState from './screens/EmptyState'

class App extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    appState: PropTypes.object,
  }

  render() {
    const { appState } = this.props
    const { tokens, redeemableToken: rdt } = appState
    const { mode, sidePanelOpened, tokenAddress } = this.state

    const showTokens = tokens && tokens.length > 0
    //show only tokens that are going to be redeemed
    const redeemables = showTokens ? tokens.filter(t => !t.amount.isZero()) : []

    return (
      <Main>
        <AppLayout
          title="Lock"
          afterTitle={rdt && <Badge.App>{token.symbol}</Badge.App>}
          mainButton={null}
          smallViewPadding={0}
        ></AppLayout>
        <SidePanel {...sidePanelProps}></SidePanel>
      </Main>
    )
  }
}

export default () => {
  return <App {...useAragonApi()} />
}
