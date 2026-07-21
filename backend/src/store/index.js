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

async function seedDemoData() {
  const s = getStore();
  const now = new Date().toISOString();

  const patient = {
    id: 'pat_demo_juan',
    egovSub: 'MVPCBEUVCGPZR', // matches the mock SSO profile uniqid → login links to this patient
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
    createdAt: now,
    updatedAt: now,
  };
  await s.create(COLLECTIONS.PATIENTS, patient);

  // A lab record from ANOTHER hospital, encrypted off-chain with a REAL anchored fingerprint
  // → powers the "no repeat labs" badge and passes the tamper-evidence recompute at verify time.
  const cbcData = { hemoglobin: '11.2 g/dL', wbc: '7.5 x10^9/L', platelets: '250 x10^9/L', interpretation: 'Mild anemia; otherwise within normal limits' };
  const cbcHash = sha256Hex({ patientId: patient.id, type: 'lab', title: 'Complete Blood Count (CBC)', sourceFacility: 'Ospital ng Maynila', data: cbcData });
  await s.create(COLLECTIONS.RECORDS, {
    id: 'rec_demo_cbc',
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

  logger.info('demo data seeded', { patientId: patient.id });
  return patient;
}

module.exports = { getStore, COLLECTIONS, seedDemoData };
