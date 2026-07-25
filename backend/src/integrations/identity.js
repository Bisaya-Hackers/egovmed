'use strict';
const { env, publicUrl } = require('../config/env');
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
const isEverifyLive = () => everify.mode === 'live';

let tokenCache = null; // { token, expiresAt }
async function everifyToken() {
  if (!everify.clientId || !everify.clientSecret) throw new Error('eVerify live mode requires client credentials');
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5000) return tokenCache.token;
  const res = await http.post(`${everify.baseUrl}/api/auth`, {
    client_id: everify.clientId,
    client_secret: everify.clientSecret,
  });
  const data = res && (res.data || res);
  const token = data && (data.access_token || data.token);
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
    // Confirmed response shape (portal docs, 2026-07): envelope is { data: { code, reference, ... } }.
    // Success indicator is the six-char status code, NOT a boolean field. AAA000 = success;
    // other codes (e.g. AAA001+, EEE...) indicate mismatch / not found / errors.
    // `reference` is the PhilSys reference (no `_id` suffix). Response also carries full PII
    // (full_name, gender, marital_status, blood_type, mobile_number, addresses) — do not surface
    // beyond what identityService already stores. NO `score` field is returned by /api/query.
    const verified = data && data.code === 'AAA000';
    return { verified, reference: data && data.reference, code: data && data.code, provider: 'everify' };
  }

  // mock: verifies as long as a name is present (demo runs offline)
  const ok = Boolean(firstName && lastName);
  return { verified: ok, score: ok ? 0.99 : 0, reference: randomId('ref_'), provider: 'mock' };
}

/* ── Face Liveness (separate hosted service) ───────────────────
 * per apidocumentation/Face-Liveness-API.md (x-api-key auth):
 *   POST /v1/liveness/session          → { token, url }
 *   GET  /v1/liveness/result/{token}   → { status, confidence_score, reference_image_url }
 * The user completes the check at `url`; accept only status "SUCCEEDED" && confidence >= minConfidence.
 * The session `token` is what gets passed to eVerify /api/query as face_liveness_session_id.
 */
const faceLiveness = env.faceLiveness;
const isLivenessLive = () => faceLiveness.mode === 'live';

async function createLivenessSession() {
  if (isLivenessLive()) {
    if (!faceLiveness.apiKey) throw new Error('Face Liveness live mode requires FACE_LIVENESS_API_KEY');
    const callbackUrl = faceLiveness.callbackUrl || publicUrl(env.appUrl, '/liveness/callback');
    if (!/^https:\/\//i.test(callbackUrl)) throw new Error('Face Liveness live mode requires an HTTPS callback URL');
    const res = await http.post(`${faceLiveness.baseUrl}/v1/liveness/session`, {
      action: faceLiveness.action,
      callback_url: callbackUrl,
      delay: 1200,
    }, { headers: { 'x-api-key': faceLiveness.apiKey, 'Content-Type': 'application/json' } });
    return { sessionId: res.token, url: res.url, provider: 'face-liveness' }; // frontend sends the user to `url`
  }
  return { sessionId: randomId('live_'), url: null, provider: 'mock' };
}

async function getLivenessResult(sessionId) {
  if (isLivenessLive()) {
    if (!faceLiveness.apiKey) throw new Error('Face Liveness live mode requires FACE_LIVENESS_API_KEY');
    const res = await http.get(`${faceLiveness.baseUrl}/v1/liveness/result/${sessionId}`, {
      headers: { 'x-api-key': faceLiveness.apiKey },
    });
    const confidence = typeof res.confidence_score === 'number' ? res.confidence_score : 0;
    const live = res.status === 'SUCCEEDED' && confidence >= faceLiveness.minConfidence;
    return { sessionId, live, confidence, status: res.status, provider: 'face-liveness' };
  }
  return { sessionId, live: true, confidence: 97, provider: 'mock' }; // 0–100 scale
}

module.exports = { verifyPhilSys, createLivenessSession, getLivenessResult };
