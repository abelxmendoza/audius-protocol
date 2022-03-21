const bs58 = require('bs58')
const Web3 = require('../web3')
const axios = require('axios')
const Hashids = require('hashids/cjs')

const { MultiProvider } = require('./multiProvider')
const { uuid } = require('./uuid')

// Hashids

const HASH_SALT = 'azowernasdfoia'
const MIN_LENGTH = 5
const hashids = new Hashids(HASH_SALT, MIN_LENGTH)

const ZeroAddress = '0x0000000000000000000000000000000000000000'

class Utils {
  static importDataContractABI (pathStr) {
    // need to specify part of path here because of https://github.com/webpack/webpack/issues/4921#issuecomment-357147299
    const importFile = require(`../../data-contracts/ABIs/${pathStr}`)

    if (importFile) return importFile
    else throw new Error(`Data contract ABI not found ${pathStr}`)
  }

  static importEthContractABI (pathStr) {
    // need to specify part of path here because of https://github.com/webpack/webpack/issues/4921#issuecomment-357147299
    const importFile = require(`../../eth-contracts/ABIs/${pathStr}`)

    if (importFile) return importFile
    else throw new Error(`Eth contract ABI not found ${pathStr}`)
  }

  static utf8ToHex (utf8Str) {
    return Web3.utils.utf8ToHex(utf8Str)
  }

  static padRight (hexStr, size) {
    return Web3.utils.padRight(hexStr, size)
  }

  static hexToUtf8 (hexStr) {
    return Web3.utils.hexToUtf8(hexStr)
  }

  static keccak256 (utf8Str) {
    return Web3.utils.keccak256(utf8Str)
  }

  static isBN (number) {
    return Web3.utils.isBN(number)
  }

  static toBN (number, base) {
    return new Web3.utils.BN(number, base)
  }

  static BN () {
    return Web3.utils.BN
  }

  static checkStrLen (str, maxLen, minLen = 1) {
    if (str === undefined || str === null || str.length > maxLen || str.length < minLen) {
      throw new Error(`String '${str}' must be between ${minLen}-${maxLen} characters`)
    }
  }

  static async wait (milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
  }

  // Regular expression to check if endpoint is a FQDN. https://regex101.com/r/kIowvx/2
  static isFQDN (url) {
    const FQDN = /(?:^|[ \t])((https?:\/\/)?(?:localhost|[\w-]+(?:\.[\w-]+)+)(:\d+)?(\/\S*)?)/gm
    return FQDN.test(url)
  }

  static isHttps (url) {
    const https = /^https:\/\//
    return https.test(url)
  }

  // Function to check if the endpont/health_check returns JSON object [ {'healthy':true} ]
  static async isHealthy (url) {
    try {
      const { data: body } = await axios.get(url + '/health_check')
      return body.data.healthy
    } catch (error) {
      return false
    }
  }

  static formatOptionalMultihash (multihash) {
    if (multihash) {
      return this.decodeMultihash(multihash).digest
    } else {
      return this.utf8ToHex('')
    }
  }

  static decodeMultihash (multihash) {
    const base16Multihash = bs58.decode(multihash)
    return {
      digest: `0x${base16Multihash.slice(2).toString('hex')}`,
      hashFn: parseInt(base16Multihash[0]),
      size: parseInt(base16Multihash[1])
    }
  }

  /**
 * Given a digest value (written on chain, obtained through AudiusABIDecoder.decodeMethod),
 * convert back to a IFPS CIDv0
 * @param {String} multihashDigest digest value from decodeMultihash
 * @returns String CID value
 */
  static encodeMultihash (multihashDigest) {
    // the 1220 is from reconstructing the hashFn and size with digest, the opposite of decodeMultihash
    // since IPFS CIDv0 has a fixed hashFn and size, the first two values are always 12 and 20
    // concat them together with digest and encode back to base58
    const digestStr = `1220${multihashDigest.replace('0x', '')}`
    // convert digestStr from hex to base 58
    return bs58.encode(Buffer.from(digestStr, 'hex'))
  }

  static parseDataFromResponse (response) {
    if (!response || !response.data) return null

    const obj = response.data

    // adapted from https://github.com/jashkenas/underscore/blob/master/underscore.js _.isEmpty function
    if (obj == null) return null
    if ((Array.isArray(obj) || typeof (obj) === 'string') && obj.length === 0) return null
    if (Object.keys(obj).length === 0) return null

    return obj
  }

  static async configureWeb3 (web3Provider, chainNetworkId, requiresAccount = true) {
    // Initializing web3 with a HttpProvider wrapper for multiple providers
    // ref: https://github.com/ChainSafe/web3.js/blob/1.x/packages/web3/types/index.d.ts#L31.
    const web3Instance = new Web3(new MultiProvider(web3Provider))

    try {
      const networkId = await web3Instance.eth.net.getId()
      if (chainNetworkId && networkId.toString() !== chainNetworkId) {
        return false
      }
      if (requiresAccount) {
        const accounts = await web3Instance.eth.getAccounts()
        if (!accounts || accounts.length < 1) {
          return false
        }
      }
    } catch (e) {
      return false
    }

    return web3Instance
  }

  static get zeroAddress () {
    return ZeroAddress
  }

  static isZeroAddress (address) {
    return (address === Utils.zeroAddress)
  }

  static makeUuid () {
    return uuid()
  }

  /**
   *
   * Decodes a string id into an int. Returns null if an invalid ID.
   * @static
   * @param {string} id
   * @returns {(number | null)} decoded
   * @memberof Utils
   */
  static decodeHashId (id) {
    try {
      const ids = hashids.decode(id)
      if (!ids.length) return null
      const num = Number(ids[0])
      if (isNaN(num)) return null
      return num
    } catch (e) {
      console.error(`Failed to decode ${id}`, e)
      return null
    }
  }

  /**
  * Encodes an int to a string based hashid
  * @static
  * @param {(number | null)} [id=null]
  * @returns {(string | null)}
  * @memberof Utils
  */
  static encodeHashId (id) {
    try {
      if (id === null) return null
      const encodedId = hashids.encode(id)
      return encodedId
    } catch (e) {
      console.error(`Failed to encode ${id}`, e)
      return null
    }
  }

  /**
   * If `promise` responds before `timeoutMs`,
   * this function returns its response; else rejects with `timeoutMessage`
   * @param {Promise} promise
   * @param {number} timeoutMs
   * @param {string} timeoutMessage
   */
  static async racePromiseWithTimeout (promise, timeoutMs, timeoutMessage) {
    const timeoutPromise = new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    })
    return Promise.race([promise, timeoutPromise])
  }
}

module.exports = Utils
