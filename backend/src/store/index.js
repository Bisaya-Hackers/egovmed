'use strict';
const { env } = require('../config/env');
const logger = require('../lib/logger');
const { createMemoryStore } = require('./memoryStore');
const { createKvStore } = require('./kvStore');
const { sha256Hex, encryptJson } = require('../lib/crypto');

const COLLECTIONS = {
  PATIENTS: 'patients',
  RECORDS: 'healthRecords',
  APPOINTMENTS: 'appointments',
  TRIAGE: 'triageResults',
  PAYMENTS: 'payments',
  REPORTS: 'reports',
  VERIFICATIONS: 'verifications',
  CONSENTS: 'consents',
  LIVENESS: 'livenessSessions',
  MESSAGES: 'messages',
  OAUTH_STATE: 'oauthState',
  AUDIT_LOGS: 'auditLogs',
};

let store;
function getStore() {
  if (store) return store;
  if (env.store.driver === 'kv') {
    if (!env.store.upstashUrl || !env.store.upstashToken) {
      // In prod, silently using non-persistent memory loses PHI — fail loudly instead.
      if (env.isProd) throw new Error('STORE_DRIVER=kv but Upstash credentials are missing — refusing to fall back to non-persistent memory in production.');
      logger.warn('STORE_DRIVER=kv but Upstash creds missing — falling back to memory store');
      store = createMemoryStore();
    } else {
      store = createKvStore();
      logger.info('using KV (Upstash) store');
    }
  } else {
    store = createMemoryStore();
    logger.info('using in-memory store');
  }
  return store;
}

// Derives the same patient id authService uses (sha256(egovsub:<uniqid>)) so a seeded demo patient
// and one created via SSO login collapse to the same record — no orphan duplicates on cold start.
const DEMO_EGOV_SUB = 'MVPCBEUVCGPZR'; // must match egovph.js mock profile uniqid
const patientIdFor = (egovSub) => 'pat_' + sha256Hex('egovsub:' + egovSub).slice(2, 22);
const DEMO_PATIENT_ID = patientIdFor(DEMO_EGOV_SUB);

// Three cross-hospital labs (matches the design's Records screen) — real values so the doctor-summary
// endpoint has meaningful clinical context to summarize. `id` is stable so seeds are idempotent.
const DEMO_RECORDS = [
  {
    id: 'rec_demo_cbc',
    type: 'lab',
    title: 'Complete Blood Count (CBC)',
    sourceFacility: 'Ospital ng Maynila',
    createdAt: '2026-06-12T09:15:00.000Z',
    summary: 'CBC within normal limits; mild anemia noted.',
    data: { hemoglobin: '11.2 g/dL', wbc: '7.5 x10^9/L', platelets: '250 x10^9/L', interpretation: 'Mild anemia; otherwise within normal limits' },
  },
  {
    id: 'rec_demo_lipid',
    type: 'lab',
    title: 'Lipid Panel',
    sourceFacility: 'Makati Medical Center',
    createdAt: '2026-05-03T10:40:00.000Z',
    summary: 'Borderline LDL; recommend dietary review at follow-up.',
    data: { total_cholesterol: '215 mg/dL', ldl: '138 mg/dL', hdl: '48 mg/dL', triglycerides: '150 mg/dL', interpretation: 'Borderline high LDL; other lipids within normal range' },
  },
  {
    id: 'rec_demo_ecg',
    type: 'lab',
    title: 'ECG Report',
    sourceFacility: 'Philippine Heart Center',
    createdAt: '2026-04-21T14:20:00.000Z',
    summary: 'Normal sinus rhythm; no acute abnormalities.',
    data: { rhythm: 'Normal sinus rhythm', rate_bpm: 72, pr_interval_ms: 160, qrs_duration_ms: 92, qt_interval_ms: 380, interpretation: 'Normal ECG; no ischemic changes' },
  },
];

/**
 * Idempotent, self-healing demo seed:
 *   1. Guarantees the demo patient has demo benefits + identityVerified — creates the patient if
 *      absent, updates in place if the demo fields are missing (e.g. a prior SSO login pre-created
 *      the row without benefits).
 *   2. Guarantees each demo lab record exists exactly once — keyed by its stable id.
 * Safe to call on every cold start; only touches demo fields, never overwrites real user activity.
 */
async function seedDemoData() {
  const s = getStore();
  const now = new Date().toISOString();

  const demoFields = {
    egovSub: DEMO_EGOV_SUB,
    // Pre-verified only when eVerify is mocked. In live mode the badge must be earned, or the
    // demo patient starts with demographics locked against the very edit needed to verify.
    identityVerified: env.everify.mode !== 'live',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    birthDate: '1990-05-14',
    sex: 'M',
    email: 'juan.delacruz@example.ph',
    phone: '+639170000000',
    address: 'Sampaloc, Manila',
    // PhilHealth only (White Card left inactive) so a real balance remains → the eGovPay step is demoable.
    benefits: { philhealth: { active: true, memberId: 'PH-0001' }, whiteCard: { active: false }, sss: { active: false } },
  };

  const existing = await s.findById(COLLECTIONS.PATIENTS, DEMO_PATIENT_ID);
  // Cold starts re-run this seed on every serverless invocation (api/index.js), so anything it
  // re-asserts will silently undo a patient's own edit within minutes of idling — a save that
  // appears to work and then reverts. `phone`, `email` and `benefits` are only filled when absent,
  // and every field listed in manuallyOverriddenFields (now including the demographics that
  // PATCH /patients/me accepts) is left alone entirely. The rest is re-asserted to keep the seed
  // self-healing.
  const overridden = new Set((existing && existing.manuallyOverriddenFields) || []);
  const patch = existing
    ? {
      ...Object.fromEntries(Object.entries(demoFields).filter(([k]) => !overridden.has(k))),
      phone: existing.phone || demoFields.phone,
      email: existing.email || demoFields.email,
      benefits: existing.benefits && Object.keys(existing.benefits).length ? existing.benefits : demoFields.benefits,
      // identityVerified is the outcome of a real eVerify + liveness run once those go live.
      // Re-asserting it on every cold start would resurrect a verified badge after a genuine
      // failure, so an existing row keeps whatever the verification flow last decided —
      // EXCEPT that the seed itself used to hand out identityVerified: true. In live eVerify mode
      // that pre-granted badge is exactly what we need the patient to earn, and it also locks the
      // demographics they must correct first. So: trust the flag only if a real verification
      // actually happened (a VERIFICATIONS row exists for them).
      identityVerified: env.everify.mode === 'live'
        ? !!(await s.findOne(COLLECTIONS.VERIFICATIONS, (v) => v.patientId === DEMO_PATIENT_ID && v.verified))
        : existing.identityVerified,
    }
    : demoFields;
  const patient = existing
    ? await s.update(COLLECTIONS.PATIENTS, DEMO_PATIENT_ID, patch)
    : await s.create(COLLECTIONS.PATIENTS, { id: DEMO_PATIENT_ID, ...patch, createdAt: now, updatedAt: now });

  // Seed each demo lab if it isn't already present — encrypted off-chain with a real content hash.
  const seededRecords = [];
  for (const spec of DEMO_RECORDS) {
    if (await s.findById(COLLECTIONS.RECORDS, spec.id)) { seededRecords.push({ id: spec.id, action: 'kept' }); continue; }
    const hash = sha256Hex({ patientId: patient.id, type: spec.type, title: spec.title, sourceFacility: spec.sourceFacility, data: spec.data });
    await s.create(COLLECTIONS.RECORDS, {
      id: spec.id,
      patientId: patient.id,
      type: spec.type,
      title: spec.title,
      sourceFacility: spec.sourceFacility,
      encrypted: encryptJson(spec.data),
      summary: spec.summary,
      anchor: { hash, txHash: sha256Hex('tx:' + hash), blockNumber: null, anchoredAt: spec.createdAt, verified: true, provider: 'mock' },
      createdAt: spec.createdAt,
      updatedAt: spec.createdAt,
    });
    seededRecords.push({ id: spec.id, action: 'created' });
  }

  logger.info('demo data seeded', { patientId: patient.id, patient: existing ? 'updated' : 'created', records: seededRecords });
  return patient;
}

module.exports = { getStore, COLLECTIONS, seedDemoData };
