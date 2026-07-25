'use strict';
const crypto = require('crypto');
const { env } = require('../config/env');
const logger = require('../lib/logger');

const cfg = env.egovChain;

// Deployed ABI — must match contracts/RecordAnchor.sol exactly.
//   anchor(bytes32,string) : write, called during record creation
//   anchoredAt(bytes32)    : view, called during tamper-evidence verify
//   Anchored(...)          : indexed event, for future off-chain indexers
const ABI = [
  'function anchor(bytes32 recordHash, string metadata) external returns (bool)',
  'function anchoredAt(bytes32 recordHash) external view returns (uint256)',
  'event Anchored(bytes32 indexed recordHash, address indexed submitter, uint256 timestamp)',
];

let ethersMod = null;
function loadEthers() {
  if (ethersMod) return ethersMod;
  // ethers is now a hard dependency (see package.json). This require will only fail if the
  // dep install itself broke — in which case exploding here is the correct behavior.
  ethersMod = require('ethers');
  return ethersMod;
}

// Redact any 0x-prefixed hex run of 40+ chars from a log message. Covers private keys (64 hex)
// and addresses (40 hex) — the latter aren't sensitive but over-redacting costs nothing.
// Defense in depth against libraries (ethers included) that echo unvalidated input into errors.
function scrubSecrets(msg) {
  return String(msg == null ? '' : msg).replace(/0x[0-9a-fA-F]{40,}/g, '0x<redacted>');
}

/**
 * Anchor a record fingerprint (hash) on eGovChain (Besu) for tamper-evidence.
 * Raw PHI never leaves the off-chain store — only the sha256 hash is anchored (Data Privacy Act 2012).
 *
 * Fail policy: FAIL-CLOSED on live anchor failure. The whole record write fails so we never
 * store a lab that cannot be verified later. RPC outage → 5xx to the caller is by design, not a bug.
 *
 * live: requires EGOVCHAIN_RPC_URL, EGOVCHAIN_PRIVATE_KEY, EGOVCHAIN_CONTRACT_ADDRESS.
 * mock: returns a deterministic pseudo-transaction hash derived from the record hash.
 */
async function anchorHash(recordHash, meta = {}) {
  if (cfg.mode === 'live' && cfg.rpcUrl) {
    try {
      return await anchorLive(recordHash, meta);
    } catch (err) {
      logger.error('eGovChain live anchor failed', { integration: 'egovChain', err: scrubSecrets(err.message) });
      throw err;
    }
  }
  return mockAnchor(recordHash);
}

async function anchorLive(recordHash, meta) {
  const ethers = loadEthers();
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
  const wallet = new ethers.Wallet(cfg.privateKey, provider);
  const contract = new ethers.Contract(cfg.contractAddress, ABI, wallet);
  // NEVER put identifiers/clinical content on-chain (Data Privacy Act). patientId, title,
  // sourceFacility etc. are dropped here — only a non-identifying record-type tag is anchored.
  const safeMeta = { type: meta.type || null, anchoredAt: new Date().toISOString() };
  // eGovChain (Besu QBFT) is zero-fee: submit with gasPrice 0 (no ETH needed for gas).
  // Note: this blocks on block confirmation inside a user-facing POST. QBFT blocks are ~1s so
  // fine at hackathon volume; if /records latency becomes an issue, capture the tx hash immediately
  // and confirm asynchronously.
  const tx = await contract.anchor(recordHash, JSON.stringify(safeMeta), { gasPrice: 0 });
  const receipt = await tx.wait();
  return {
    hash: recordHash,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    anchoredAt: new Date().toISOString(),
    verified: true,
    provider: 'egovchain',
  };
}

function mockAnchor(recordHash) {
  const txHash = '0x' + crypto.createHash('sha256').update('tx:' + recordHash).digest('hex');
  return { hash: recordHash, txHash, blockNumber: null, anchoredAt: new Date().toISOString(), verified: true, provider: 'mock' };
}

/**
 * Verify a hash is anchored (used by the "verified lab" badge).
 *
 * Real check: eth_call → anchoredAt(recordHash). A non-zero return means the same hash
 * exists on-chain, which combined with the off-chain contentHash comparison in recordService
 * gives real tamper-evidence. The previous eth_getTransactionReceipt approach only proved
 * a transaction existed — it never checked that the anchored hash matched the record.
 *
 * Fail policy: fail-safe. RPC outage → verified:false so a badge is only shown when we're
 * sure. A bad rpc must never grant a green badge.
 */
async function verifyAnchor(recordHash, txHash) {
  if (cfg.mode !== 'live' || !cfg.rpcUrl || !cfg.contractAddress) {
    // mock / unconfigured: preserve prior behavior (any non-empty txHash trusted).
    return { verified: cfg.mode !== 'live' && !!txHash, recordHash, txHash };
  }
  if (!recordHash) return { verified: false, recordHash, txHash, error: 'missing_hash' };
  try {
    const ethers = loadEthers();
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
    const contract = new ethers.Contract(cfg.contractAddress, ABI, provider);
    const ts = await contract.anchoredAt(recordHash); // BigInt; 0 = never anchored
    const verified = ts !== undefined && ts !== null && BigInt(ts) > 0n;
    return { verified, recordHash, txHash, anchoredAt: verified ? Number(ts) : null };
  } catch (err) {
    logger.warn('anchor verify RPC failed — silently degrading', { integration: 'egovChain', fallback: 'rpc_unavailable', err: scrubSecrets(err.message) });
    return { verified: false, recordHash, txHash, error: 'rpc_unavailable' };
  }
}

module.exports = { anchorHash, verifyAnchor };
