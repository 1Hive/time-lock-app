import React from 'react'
import PropTypes from 'prop-types'
import { Split } from '@aragon/ui'
import styled from 'styled-components'

import LockTable from './LockTable'
import LockSettings from './LockSettings'

export default function Locks(props) {
  const { locks, settings } = props

  return (
    <Split
      primary={<LockTable locks={locks} token={settings.token} />}
      secondary={<LockSettings {...settings} />}
    />
  )
}

Locks.propTypes = {
  locks: PropTypes.array.isRequired,
  settings: PropTypes.object.isRequired,
}
