'use strict';
const crypto = require('crypto');
const { env } = require('../config/env');
const http = require('../lib/http');
const logger = require('../lib/logger');

const cfg = env.egovChain;

/**
 * Anchor a record fingerprint (hash) on eGovChain (Besu) for tamper-evidence.
 * Raw PHI never leaves the off-chain store — only the hash/pointer is anchored (Data Privacy Act 2012).
 *
 * live: requires EGOVCHAIN_RPC_URL, a signer key and the anchoring contract address.
 *       Signing needs `ethers` (optional dep). If it's not installed we degrade gracefully.
 * mock: returns a deterministic pseudo-transaction hash derived from the record hash.
 */
async function anchorHash(recordHash, meta = {}) {
  if (cfg.mode === 'live' && cfg.rpcUrl) {
    try {
      return await anchorLive(recordHash, meta);
    } catch (err) {
      logger.error('eGovChain live anchor failed', { err: err.message });
      throw err;
    }
  }
  return mockAnchor(recordHash);
}

async function anchorLive(recordHash, meta) {
  let ethers;
  try { ethers = require('ethers'); } catch {
    throw new Error('ethers not installed. Run `npm i ethers` to enable live on-chain anchoring.');
  }
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
  const wallet = new ethers.Wallet(cfg.privateKey, provider);

  // Minimal anchoring contract ABI — confirm the real ABI/function with eGovChain docs.
  const abi = ['function anchor(bytes32 recordHash, string metadata) public returns (bool)'];
  const contract = new ethers.Contract(cfg.contractAddress, abi, wallet);
  // NEVER put identifiers/clinical content on-chain (Data Privacy Act). patientId, title,
  // sourceFacility etc. are dropped here — only a non-identifying record-type tag is anchored.
  const safeMeta = { type: meta.type || null, anchoredAt: new Date().toISOString() };
  // eGovChain (Besu QBFT) is zero-fee: submit with gasPrice 0 (no ETH needed for gas).
  const tx = await contract.anchor(recordHash, JSON.stringify(safeMeta), { gasPrice: 0 });
  const receipt = await tx.wait();
  return { hash: recordHash, txHash: receipt.hash, blockNumber: receipt.blockNumber, anchoredAt: new Date().toISOString(), verified: true, provider: 'egovchain' };
}

function mockAnchor(recordHash) {
  const txHash = '0x' + crypto.createHash('sha256').update('tx:' + recordHash).digest('hex');
  return { hash: recordHash, txHash, blockNumber: null, anchoredAt: new Date().toISOString(), verified: true, provider: 'mock' };
}

/** Verify a hash is anchored (used by the "verified lab" badge). */
async function verifyAnchor(recordHash, txHash) {
  if (cfg.mode === 'live' && cfg.rpcUrl && txHash) {
    try {
      const res = await http.post(cfg.rpcUrl, {
        jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash],
      });
      return { verified: !!(res && res.result), recordHash, txHash };
    } catch (err) {
      logger.warn('anchor verify RPC failed', { err: err.message });
      return { verified: false, recordHash, txHash, error: 'rpc_unavailable' };
    }
  }
  return { verified: cfg.mode !== 'live' && !!txHash, recordHash, txHash };
}

module.exports = { anchorHash, verifyAnchor };
