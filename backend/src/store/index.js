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
const DEMO_RECORD_ID = 'rec_demo_cbc';

/**
 * Idempotent, self-healing demo seed:
 *   1. Guarantees the demo patient has demo benefits + identityVerified — creates the patient if
 *      absent, updates in place if the demo fields are missing (e.g. a prior SSO login pre-created
 *      the row without benefits).
 *   2. Guarantees the cross-hospital lab record exists exactly once — keyed by DEMO_RECORD_ID.
 * Safe to call on every cold start; only touches demo fields, never overwrites real user activity.
 */
async function seedDemoData() {
  const s = getStore();
  const now = new Date().toISOString();

  const demoFields = {
    egovSub: DEMO_EGOV_SUB,
    identityVerified: true,
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
  const patient = existing
    ? await s.update(COLLECTIONS.PATIENTS, DEMO_PATIENT_ID, demoFields)
    : await s.create(COLLECTIONS.PATIENTS, { id: DEMO_PATIENT_ID, ...demoFields, createdAt: now, updatedAt: now });

  // Lab record from ANOTHER hospital, encrypted off-chain with a REAL anchored fingerprint.
  // Idempotent: only create if the demo record id isn't already there.
  const existingRecord = await s.findById(COLLECTIONS.RECORDS, DEMO_RECORD_ID);
  if (!existingRecord) {
    const cbcData = { hemoglobin: '11.2 g/dL', wbc: '7.5 x10^9/L', platelets: '250 x10^9/L', interpretation: 'Mild anemia; otherwise within normal limits' };
    const cbcHash = sha256Hex({ patientId: patient.id, type: 'lab', title: 'Complete Blood Count (CBC)', sourceFacility: 'Ospital ng Maynila', data: cbcData });
    await s.create(COLLECTIONS.RECORDS, {
      id: DEMO_RECORD_ID,
      patientId: patient.id,
      type: 'lab',
      title: 'Complete Blood Count (CBC)',
      sourceFacility: 'Ospital ng Maynila',
      encrypted: encryptJson(cbcData),
      summary: 'CBC within normal limits; mild anemia noted.',
      anchor: { hash: cbcHash, txHash: sha256Hex('tx:' + cbcHash), blockNumber: null, anchoredAt: now, verified: true, provider: 'mock' },
      createdAt: now,
      updatedAt: now,
    });
  }

  logger.info('demo data seeded', { patientId: patient.id, action: existing ? 'updated' : 'created', record: existingRecord ? 'kept' : 'created' });
  return patient;
}

module.exports = { getStore, COLLECTIONS, seedDemoData };
