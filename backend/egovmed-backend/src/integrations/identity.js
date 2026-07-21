'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');
const { randomId } = require('../lib/crypto');

/* ── National ID eVerify (PhilSys) ─────────────────────────── */
const everify = env.everify;

async function verifyPhilSys({ philsysId, firstName, lastName, birthDate, consent }) {
  if (!consent) return { verified: false, reason: 'consent_required' };

  if (everify.mode === 'live' && everify.apiKey) {
    // NOTE: confirm request/response shape with eVerify docs.
    const res = await http.post(`${everify.baseUrl}/v1/verify`, {
      psn: philsysId, first_name: firstName, last_name: lastName, birth_date: birthDate,
    }, { headers: { Authorization: `Bearer ${everify.apiKey}` } });
    return { verified: !!res.match, score: res.score, reference: res.reference_id, provider: 'everify' };
  }

  // mock: verifies as long as an ID and name are present
  const ok = Boolean(philsysId && firstName && lastName);
  return { verified: ok, score: ok ? 0.99 : 0, reference: randomId('ref_'), provider: 'mock' };
}

/* ── Face Liveness ─────────────────────────────────────────── */
const liveness = env.faceLiveness;

async function createLivenessSession() {
  if (liveness.mode === 'live' && liveness.apiKey) {
    const res = await http.post(`${liveness.baseUrl}/v1/sessions`, {}, {
      headers: { Authorization: `Bearer ${liveness.apiKey}` },
    });
    return { sessionId: res.session_id, clientToken: res.client_token, provider: 'face-liveness' };
  }
  return { sessionId: randomId('live_'), clientToken: randomId('tok_'), provider: 'mock' };
}

async function getLivenessResult(sessionId) {
  if (liveness.mode === 'live' && liveness.apiKey) {
    const res = await http.get(`${liveness.baseUrl}/v1/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${liveness.apiKey}` },
    });
    return { sessionId, live: res.status === 'SUCCEEDED' && res.confidence >= 0.8, confidence: res.confidence, provider: 'face-liveness' };
  }
  return { sessionId, live: true, confidence: 0.97, provider: 'mock' };
}

module.exports = { verifyPhilSys, createLivenessSession, getLivenessResult };
