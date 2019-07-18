# Lock <img align="right" src="https://github.com/1Hive/website/blob/master/website/static/img/bee.png" height="80px" />

[![CircleCI](https://circleci.com/gh/1Hive/lock-app.svg?style=svg)](https://circleci.com/gh/1Hive/lock-app)
[![Coverage Status](https://coveralls.io/repos/github/1Hive/lock-app/badge.svg?branch=master&service=github)](https://coveralls.io/github/1Hive/lock-app?branch=master&service=github)

1Hive's Lock app allows an Aragon organization to require users to lock tokens by sending them to the Lock app for a configurable period of time in order to forward an intent. For example the organization may require users to lock 100 tokens for 1 month before creating a new vote. The user would be able to come back in a month and claim their deposited tokens.

#### 🐲 Project stage: development

The Lock app is still in development and hasn't been published to APM. If you are interested in contributing please see our open [issues](https://github.com/1hive/lock-app/issues).

#### 🚨 Security review status: pre-audit

The code in this repo has not been audited.

## How does it work

The lock app is a [forwarder](https://hack.aragon.org/docs/forwarding-intro). By granting the lock app a permission like `Create Votes` the user will be prompted and required to lock tokens before the user's intent can be forwarded.

We do not protect the lock function with a role, so anyone is able to make locks and forward actions. We keep track of when deposits are made and by whom so that users are only able to re-claim deposits that they have made after the duration has elapsed.

### Initialization

The deposits app is initialized with a `duration`, `token`, and `lock_amount` parameters which determines how long deposits are locked. The `token` parameter can be set at initialization and not changed. If a change is necessary the user can install a new instance and change permissions in the organization to reflect the change.

### Roles

The lock app should implement the following roles:

- **Change Duration**: This allows for changing the configured duration. This should not impact the claiming process for existing deposits.
- **Change Lock Amount**: This allows for changing the amount of tokens required to lock. This should not impact the claiming process for existing deposits.

### Interface

The deposits app provides an interface for a user to see any deposits they have made, and how much time until they can re-claim the deposit.

The deposits app does not provide an interface for changing the duration or lock amount. This can be done via the CLI or directly interacting with the contract.

## How to run

TODO:

## How to deploy to an organization

TODO:
