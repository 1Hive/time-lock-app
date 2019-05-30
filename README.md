# Deposits <img align="right" src="https://github.com/1Hive/website/blob/master/website/static/img/bee.png" height="80px" />

1Hive's Deposits app allows an organization to require users to lock tokens by sending them to the deposits app for a configurable duration in order to forward an intent. For example the organization may require users to lock 100 organization tokens for 1 month before creating a new vote. The user would be able to come back in a month and claim their deposited tokens. 

#### 🐲 Project stage: development

The Redemptions app is still in development and hasn't been published to APM. If you are interested in contributing please see our open [issues](https://github.com/1hive/deposits-app/issues).

#### 🚨 Security review status: pre-audit

The code in this repo has not been audited.

## How does it work

The deposits app is a [forwarder](https://hack.aragon.org/docs/forwarding-intro). By granting the deposits app a permission like `Create Votes` the user will be prompted and required to make a deposit before the users intent is forwarded. 

We do not protect the deposit function with a role, so anyone is able to make deposits and forward actions. We keep track of when deposits are made and by whom so that users are only able to re-claim deposits that they have made after the duration has elapsed.

### Initialization

The deposits app is initialized with a `duration` parameter which determines how long deposits are locked. 

### Roles
The deposits app should implement the following roles:

- **Change Duration**: This allows for changing the configured duration. This can impact current deposits (eg if the duration is increased, existing deposits are locked for a longer period, and if the duration is decreased, existing deposits can be re-claimed sooner).  

### Interface

The deposits app provides an interface for a user to see any deposits they have made, and how much time until they can re-claim the deposit. 

The deposits app does not provide an interface for changing the duration. This can be done via the CLI or directly interacting with the contract.

## How to run

TODO:

## How to deploy to an organization

TODO:
