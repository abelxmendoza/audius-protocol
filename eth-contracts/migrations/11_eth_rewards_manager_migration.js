const contractConfig = require('../contract-config.js')
const _lib = require('../utils/lib')
const AudiusAdminUpgradeabilityProxy = artifacts.require('AudiusAdminUpgradeabilityProxy')
const EthRewardsManager = artifacts.require('EthRewardsManager')
const Governance = artifacts.require('Governance')
const MockWormhole = artifacts.require('MockWormhole')

const ethRewardsManagerProxyKey = web3.utils.utf8ToHex('EthRewardsManagerProxy')

module.exports = (deployer, network, accounts) => {
  deployer.then(async () => {
    const config = contractConfig[network]
    const proxyAdminAddress = config.proxyAdminAddress || accounts[10]
    const proxyDeployerAddress = config.proxyDeployerAddress || accounts[11]
    const guardianAddress = config.guardianAddress || proxyDeployerAddress
    const solanaRecipientAddress = config.solanaRecipientAddress || Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
    const antiAbuseOracleAddress = config.antiAbuseOracleAddress || accounts[12]
    let wormholeAddress = config.wormholeAddress

    const tokenAddress = process.env.tokenAddress
    const governanceAddress = process.env.governanceAddress

    const governance = await Governance.at(governanceAddress)

    if (wormholeAddress === null) {
      const mockWormhole = await deployer.deploy(MockWormhole, { from: proxyDeployerAddress })
      wormholeAddress = mockWormhole.address
    }

    // Deploy EthRewardsManager logic and proxy contracts + register proxy
    const ethRewardsManager0 = await deployer.deploy(EthRewardsManager, { from: proxyDeployerAddress })
    const initializeCallData = _lib.encodeCall(
      'initialize',
      ['address', 'address', 'address', 'bytes32', 'address'],
      [tokenAddress, governanceAddress, wormholeAddress, solanaRecipientAddress, antiAbuseOracleAddress]
    )

    const ethRewardsManagerProxy = await deployer.deploy(
      AudiusAdminUpgradeabilityProxy,
      ethRewardsManager0.address,
      governanceAddress,
      initializeCallData,
      { from: proxyDeployerAddress }
    )

    const ethRewardsManager = await EthRewardsManager.at(ethRewardsManagerProxy.address)
    _lib.registerContract(governance, ethRewardsManagerProxyKey, ethRewardsManagerProxy.address, guardianAddress)

    // Set environment variable
    process.env.ethRewardsManagerAddress = ethRewardsManagerProxy.address
  })
}
