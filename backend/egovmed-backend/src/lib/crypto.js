'use strict';
const crypto = require('crypto');
const { env } = require('../config/env');
const logger = require('./logger');

// Resolve a 32-byte key from PHI_ENCRYPTION_KEY (hex or base64 or utf8), else generate an ephemeral one.
function resolveKey() {
  const raw = env.phiKey;
  if (!raw) {
    logger.warn('PHI_ENCRYPTION_KEY missing — using ephemeral key');
    return crypto.randomBytes(32);
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const b64 = Buffer.from(raw, 'base64');
  if (b64.length === 32) return b64;
  return crypto.createHash('sha256').update(raw).digest(); // derive 32 bytes from any passphrase
}
const KEY = resolveKey();

/** sha256 hex of any JSON-serializable value — the fingerprint anchored on eGovChain. */
function sha256Hex(value) {
  const input = typeof value === 'string' ? value : JSON.stringify(value);
  return '0x' + crypto.createHash('sha256').update(input).digest('hex');
}

/** Encrypt PHI at rest. Returns a self-describing string: v1:iv:tag:ciphertext (all base64). */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

function decrypt(payload) {
  const [v, ivB64, tagB64, dataB64] = String(payload).split(':');
  if (v !== 'v1') throw new Error('unsupported ciphertext version');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

const encryptJson = (obj) => encrypt(JSON.stringify(obj));
const decryptJson = (payload) => JSON.parse(decrypt(payload));

const randomId = (prefix = '') => `${prefix}${crypto.randomBytes(9).toString('base64url')}`;

module.exports = { sha256Hex, encrypt, decrypt, encryptJson, decryptJson, randomId };
