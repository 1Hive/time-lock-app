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

The deposits app is initialized with a `token`, `_lockDuration`, and `_lockAmount` parameters which determines how long deposits are locked and the amount to deposit.
The `token` parameter can be set at initialization and not changed. If a change is necessary the user can install a new instance and change permissions in the organization to reflect the change.

### Roles

The lock app should implement the following roles:

- **Change Duration**: This allows for changing the configured duration. This should not impact the claiming process for existing deposits.
- **Change Lock Amount**: This allows for changing the amount of tokens required to lock. This should not impact the claiming process for existing deposits.

### Interface

The deposits app provides an interface for a user to see any deposits they have made, and how much time until they can re-claim the deposit. It also shows the total unlocked balance they currently have for re-claim.

The deposits app does not provide an interface for changing the duration or lock amount. This can be done via the CLI or directly interacting with the contract.

## How to run Lock app locally

First make sure that you have node, npm, and the Aragon CLI installed and working. Instructions on how to set that up can be found [here](https://hack.aragon.org/docs/cli-intro.html). You'll also need to have [Metamask](https://metamask.io) or some kind of web wallet enabled to sign transactions in the browser.

Git clone this repo.

```sh
git clone https://github.com/1Hive/lock-app.git
```

Navigate into the `lock-app` directory.

```sh
cd lock-app
```

Install npm dependencies.

```sh
npm i
```

Deploy a dao with Lock app installed on your local environment.

```sh
npm run start:template
```

If everything is working correctly, your new DAO will be deployed and your browser will open http://localhost:3000/#/YOUR-DAO-ADDRESS. It should look something like this:

![Newly deploy DAO with lock app](https://i.imgur.com/prqaPXa.png)

You will also see the configuration for your local deployment in the terminal. It should look something like this:

```sh
    Ethereum Node: ws://localhost:8545
    ENS registry: 0x5f6f7e8cc7346a11ca2def8f827b7a0b612c56a1
    APM registry: aragonpm.eth
    DAO address: YOUR-DAO-ADDRESS
```

### Template

The Lock app is initialized with a `_lockDuration` of 1:30 minutes and a `_lockAmount` of 20 LKT tokens.
The app has the permission to create votes, so if you try to mint yourself some tokens from the `tokens` app it will first prompt you to approve the Lock app to transfer 20 LKT tokens to the contract on your behalf.
Once the forwarding is performed you should be able to see the current lock and a timer indicating how much time until you can re-claim your 20 LKT tokens.

### Re-claiming your tokens

Once your balance is unlocked you will be able to re-claim your tokens via the withdraw button.
You will have to input how many locks you'll re-claim and they'll be withdrawn on a FIFO bassis (first in first out)

## How to deploy Lock app to an organization

TODO: Deploy lock to rinkeby

To deploy to an organization you can use the [Aragon CLI](https://hack.aragon.org/docs/cli-intro.html).

```sh
aragon dao install <dao-address> lock.open.aragonpm.eth --app-init-args <token-address> <lock-duration> <lock-amount>
```

You have to set up permissions depending on your requirements for users to lock tokens before forwarding an intent. So for example if you want to require users to lock tokens before creating votes you should grant the Lock app the role to create votes on the Voting app.

:warning: <span style="color:#f3d539">Currently the Lock app has to be the first forwarder in the transaction pathing in order to properly prompt you to perform an approve for the required amount of tokens</span>

## Contributing

We welcome community contributions!

Please check out our [open Issues](https://github.com/1Hive/lock-app/issues) to get started.

If you discover something that could potentially impact security, please notify us immediately. The quickest way to reach us is via the #dev channel in our [team Keybase chat](https://1hive.org/contribute/keybase). Just say hi and that you discovered a potential security vulnerability and we'll DM you to discuss details.
