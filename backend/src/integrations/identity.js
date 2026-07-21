'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');
const { randomId } = require('../lib/crypto');

/* ── National ID eVerify (NIDAS) ───────────────────────────────
 * Live flow, per apidocumentation/eVerify-NationalID-API.md:
 *   1) POST /api/auth  { client_id, client_secret }                    → access_token
 *   2) POST /api/query { first_name, middle_name, last_name, suffix,
 *                        birth_date (YYYY-MM-DD), face_liveness_session_id }
 *        with  Authorization: Bearer <access_token>
 * The face_liveness_session_id is produced by the eVerify Face Liveness Web SDK on the
 * client (window.eKYC().start({ pubKey }) → result.session_id) and passed through here.
 */
const everify = env.everify;
const isEverifyLive = () => everify.mode === 'live' && everify.clientId && everify.clientSecret;

let tokenCache = null; // { token, expiresAt }
async function everifyToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5000) return tokenCache.token;
  const res = await http.post(`${everify.baseUrl}/api/auth`, {
    client_id: everify.clientId,
    client_secret: everify.clientSecret,
  });
  const token = res && (res.access_token || res.token);
  if (!token) throw new Error('eVerify /api/auth returned no access_token');
  tokenCache = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

async function verifyPhilSys({ firstName, middleName, lastName, suffix, birthDate, faceLivenessSessionId, consent }) {
  if (!consent) return { verified: false, reason: 'consent_required' };

  if (isEverifyLive()) {
    const token = await everifyToken();
    const res = await http.post(`${everify.baseUrl}/api/query`, {
      first_name: firstName,
      middle_name: middleName || undefined,
      last_name: lastName,
      suffix: suffix || undefined,
      birth_date: birthDate, // YYYY-MM-DD
      face_liveness_session_id: faceLivenessSessionId,
    }, { headers: { Authorization: `Bearer ${token}` } });
    const data = res && (res.data || res);
    const matched = data && (data.verified ?? data.match ?? data.matched);
    return { verified: !!matched, score: data.score, reference: data.reference_id || data.reference, provider: 'everify' };
  }

  // mock: verifies as long as a name is present (demo runs offline)
  const ok = Boolean(firstName && lastName);
  return { verified: ok, score: ok ? 0.99 : 0, reference: randomId('ref_'), provider: 'mock' };
}

/* ── Face Liveness (eVerify Web SDK) ───────────────────────────
 * In live mode the CLIENT runs the eVerify Face Liveness Web SDK with `pubKey` and obtains a
 * session_id; the backend only hands over the pubKey and later consumes that id in /api/query.
 * (There is no server-side "create liveness session" endpoint in the eVerify API.)
 */
async function createLivenessSession() {
  const live = everify.mode === 'live' && everify.livenessPubKey;
  return {
    sessionId: randomId('live_'),           // demo id (live: client SDK provides the real one)
    pubKey: live ? everify.livenessPubKey : null,
    provider: live ? 'everify-liveness' : 'mock',
  };
}

// Liveness is validated by eVerify during /api/query. This keeps the demo's capture→verify UX offline.
async function getLivenessResult(sessionId) {
  return { sessionId, live: true, confidence: 0.97, provider: everify.mode === 'live' ? 'everify-liveness' : 'mock' };
}

module.exports = { verifyPhilSys, createLivenessSession, getLivenessResult };
