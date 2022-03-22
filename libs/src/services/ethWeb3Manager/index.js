const Web3 = require('../../web3')
const { MultiProvider } = require('../../utils/multiProvider')
const EthereumTx = require('ethereumjs-tx').Transaction
const { estimateGas } = require('../../utils/estimateGas')
const retry = require('async-retry')
const MIN_GAS_PRICE = Math.pow(10, 9) // 1 GWei, ETH minimum allowed gas price
const HIGH_GAS_PRICE = 250 * MIN_GAS_PRICE // 250 GWei
const DEFAULT_GAS_PRICE = 100 * MIN_GAS_PRICE // 100 Gwei is a reasonably average gas price
const MAX_GAS_LIMIT = 5000000 // We've seen prod tx's take up to 4M. Set to the highest we've observed + a buffer

/** Singleton state-manager for Audius Eth Contracts */
class EthWeb3Manager {
  constructor (web3Config, identityService, hedgehog) {
    if (!web3Config) throw new Error('web3Config object not passed in')
    if (!web3Config.providers) throw new Error('missing web3Config property: providers')

    // MultiProvider implements a web3 provider with fallback.
    const provider = new MultiProvider(web3Config.providers)

    this.web3Config = web3Config
    this.web3 = new Web3(provider)
    this.identityService = identityService
    this.hedgehog = hedgehog

    if (this.web3Config.ownerWallet) {
      this.ownerWallet = this.web3Config.ownerWallet
    } else {
      const storedWallet = this.hedgehog.getWallet()
      if (storedWallet) {
        this.ownerWallet = storedWallet
      }
    }
  }

  getWeb3 () { return this.web3 }

  getWalletAddress () {
    if (this.ownerWallet) {
      return this.ownerWallet.toLowerCase()
    }
    throw new Error('Owner wallet not set')
  }

  /**
   * Signs provided string data (should be timestamped).
   * @param {string} data
   */
  async sign (data) {
    return this.web3.eth.personal.sign(this.web3.utils.fromUtf8(data), this.getWalletAddress())
  }

  async sendTransaction (
    contractMethod,
    contractAddress = null,
    privateKey = null,
    txRetries = 5,
    txGasLimit = null
  ) {
    const gasLimit = txGasLimit || await estimateGas({
      method: contractMethod,
      from: this.ownerWallet,
      gasLimitMaximum: MAX_GAS_LIMIT
    })
    if (contractAddress && privateKey) {
      let gasPrice = parseInt(await this.web3.eth.getGasPrice())
      if (isNaN(gasPrice) || gasPrice > HIGH_GAS_PRICE) {
        gasPrice = DEFAULT_GAS_PRICE
      } else if (gasPrice === 0) {
        // If the gas is zero, the txn will likely never get mined.
        gasPrice = MIN_GAS_PRICE
      }
      gasPrice = '0x' + gasPrice.toString(16)

      const privateKeyBuffer = Buffer.from(privateKey, 'hex')
      const walletAddress = this.getWalletAddress()
      const txCount = await this.web3.eth.getTransactionCount(walletAddress)
      const encodedABI = contractMethod.encodeABI()
      const txParams = {
        nonce: this.web3.utils.toHex(txCount),
        gasPrice: gasPrice,
        gasLimit,
        data: encodedABI,
        to: contractAddress,
        value: '0x00'
      }
      const tx = new EthereumTx(txParams)
      tx.sign(privateKeyBuffer)
      const signedTx = '0x' + tx.serialize().toString('hex')

      // Send the tx with retries
      const response = await retry(async () => {
        return this.web3.eth.sendSignedTransaction(signedTx)
      }, {
        // Retry function 5x by default
        // 1st retry delay = 500ms, 2nd = 1500ms, 3rd...nth retry = 4000 ms (capped)
        minTimeout: 500,
        maxTimeout: 4000,
        factor: 3,
        retries: txRetries,
        onRetry: (err, i) => {
          if (err) {
            console.log(`libs ethWeb3Manager transaction send retry error : ${err}`)
          }
        }
      })

      return response
    }

    const gasPrice = parseInt(await this.web3.eth.getGasPrice())
    return contractMethod.send({ from: this.ownerWallet, gas: gasLimit, gasPrice: gasPrice })
  }

  /**
   * Relays an eth transaction via the identity service with retries
   * The relay pays for the transaction fee on behalf of the user
   * The gas Limit is estimated if not provided
   *
   * @param {*} contractMethod
   * @param {string} contractAddress
   * @param {string} ownerWallet
   * @param {string} relayerWallet
   * @param {number?} txRetries
   * @param {number?} txGasLimit
   * @returns {
   *   txHash: string,
   *   txParams: {
   *      data: string
   *      gasLimit: string
   *      gasPrice: number
   *      nonce: string
   *      to: string
   *      value: string
   *   }
   * }
   */
  async relayTransaction (
    contractMethod,
    contractAddress,
    ownerWallet,
    relayerWallet,
    txRetries = 5,
    txGasLimit = null
  ) {
    const encodedABI = contractMethod.encodeABI()
    const gasLimit = txGasLimit || await estimateGas({
      from: relayerWallet,
      method: contractMethod,
      gasLimitMaximum: MAX_GAS_LIMIT
    })
    const response = await retry(async bail => {
      try {
        const attempt = await this.identityService.ethRelay(
          contractAddress,
          ownerWallet,
          encodedABI,
          gasLimit
        )
        return attempt
      } catch (e) {
        if (e.response && e.response.status && e.response.status === 429) {
          // Don't retry in the case we are getting rate limited
          bail(new Error('Please wait before trying again'))
          return
        }
        // Trigger a retry
        throw e
      }
    }, {
      // Retry function 5x by default
      // 1st retry delay = 500ms, 2nd = 1500ms, 3rd...nth retry = 4000 ms (capped)
      minTimeout: 500,
      maxTimeout: 4000,
      factor: 3,
      retries: txRetries,
      onRetry: (err, i) => {
        if (err) {
          console.log(`libs ethWeb3Manager transaction relay retry error : ${err}`)
        }
      }
    })
    return response.resp
  }

  async getRelayMethodParams (contractAddress, contractMethod, relayerWallet) {
    const encodedABI = contractMethod.encodeABI()
    const gasLimit = await estimateGas({
      from: relayerWallet,
      method: contractMethod,
      gasLimitMaximum: HIGH_GAS_PRICE
    })
    return {
      contractAddress,
      encodedABI,
      gasLimit
    }
  }
}

module.exports = EthWeb3Manager
