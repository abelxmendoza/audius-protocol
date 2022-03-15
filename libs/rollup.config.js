import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

import pkg from './package.json'

const extensions = ['.js', '.ts']

export default {
  input: 'src/index.js',
  output: [
    { file: pkg.mainDist, format: 'cjs', exports: 'named', sourcemap: true }
  ],
  plugins: [
    commonjs({
      extensions,
      dynamicRequireTargets: [
        'data-contracts/ABIs/*.json',
        'eth-contracts/ABIs/*.json'
      ]
    }),
    json(),
    resolve({ extensions, preferBuiltins: true }),
    typescript()
  ],
  external: [
    '@audius/hedgehog',
    '@certusone/wormhole-sdk',
    '@ethersproject/solidity',
    '@solana/spl-token',
    '@solana/web3.js',
    'ajv',
    'async-retry',
    'axios',
    'borsh',
    'bs58',
    'elliptic',
    'esm',
    'eth-sig-util',
    'ethereumjs-tx',
    'ethereumjs-util',
    'ethereumjs-wallet',
    'ethers',
    'ethers/lib/utils',
    'ethers/lib/index',
    'form-data',
    'hashids',
    'jsonschema',
    'lodash',
    'node-localstorage',
    'proper-url-join',
    'semver',
    'web3',
    'xmlhttprequest',
    'abi-decoder',
    'bn.js',
    'keccak256',
    'secp256k1',
    'assert',
    'util',
    'hashids/cjs',
    'safe-buffer'
  ]
}
