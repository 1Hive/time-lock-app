const getAccounts = require('./helpers/get-accounts')
const BN = require('bn.js')
const chalk = require('chalk')

//artifacts
const Kernel = this.artifacts.require('Kernel')
const ACL = this.artifacts.require('ACL')
const TimeLock = this.artifacts.require('TimeLock')
const TokenBalanceOracle = this.artifacts.require('TokenBalanceOracle')

//colors
const error = chalk.red
const info = chalk.yellow
const success = chalk.green
const highlight = chalk.bgBlue.whiteBright.bold

const globalWeb3 = this.web3 // Not injected unless called directly via truffle
const defaultOwner = process.env.OWNER
const ANY_ENTITY = '0x'.padEnd(42, 'f')

//oracle params
const ORACLE_PARAM_ID = new BN(203).shln(248)
const EQ = new BN(1).shln(240)

const log = (text, color = chalk.white) => {
  console.log(color(text))
}

module.exports = async ({ web3 = globalWeb3, owner = defaultOwner } = {}) => {
  if (!owner) {
    const accounts = await getAccounts(web3)
    owner = accounts[0]
    log(`No OWNER environment variable passed, setting ENS owner to provider's account: ${owner}`)
  }

  const args = process.argv.slice(4)
  if (args.length < 3) {
    log(`Missing argument, expected 3 got ${args.length}`, error)
    log('- Arguments: <dao-address> <time-lock-address> <oracle-address>', info)
    return
  }

  //get args
  const [daoAddress, timeLockAddress, oracleAddress, grantee = ANY_ENTITY] = args

  try {
    const kernel = await Kernel.at(daoAddress)
    const acl = await ACL.at(await kernel.acl())
    const timeLock = await TimeLock.at(timeLockAddress)

    await checkOracle(oracleAddress)

    //convert oracle address to BN and get param256: [(uint256(ORACLE_PARAM_ID) << 248) + (uint256(EQ) << 240) + oracleAddress];
    const oracleAddressBN = new BN(oracleAddress.slice(2), 16)
    const params = [ORACLE_PARAM_ID.add(EQ).add(oracleAddressBN)]

    await acl.grantPermissionP(grantee, timeLock.address, await timeLock.LOCK_TOKENS_ROLE(), params)
    log(
      `ACL oracle permission granted succesfully to ${highlight(
        grantee == ANY_ENTITY ? 'Any account' : grantee
      )} in app ${highlight(timeLockAddress)}`,
      success
    )
  } catch (err) {
    log(err, error)
  }
}

/** Check if the address provided is a TokenBalanceOracle by calling one of it's getters */
const checkOracle = async address => {
  try {
    const oracle = await TokenBalanceOracle.at(address)
    await oracle.minBalance()
  } catch (err) {
    throw `Error checking oracle: ${err}\n${info('Make sure the provided address is a Token balance oracle')}`
  }
}
