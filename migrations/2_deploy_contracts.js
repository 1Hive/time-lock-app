var App = artifacts.require('./Lock.sol')

module.exports = function (deployer) {
  deployer.deploy(App)
}
