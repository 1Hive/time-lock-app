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


    return (
      <Main>
        <AppLayout
          title="Lock"
          mainButton={null}
          smallViewPadding={0}
        ></AppLayout>
        <SidePanel></SidePanel>
      </Main>
    )
  }
}

export default () => {
  return <App {...useAragonApi()} />
}
