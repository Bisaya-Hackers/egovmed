'use strict';
const { env } = require('../config/env');
const logger = require('../lib/logger');
const { createMemoryStore } = require('./memoryStore');
const { createKvStore } = require('./kvStore');

const COLLECTIONS = {
  PATIENTS: 'patients',
  RECORDS: 'healthRecords',
  APPOINTMENTS: 'appointments',
  TRIAGE: 'triageResults',
  PAYMENTS: 'payments',
  REPORTS: 'reports',
  VERIFICATIONS: 'verifications',
  LIVENESS: 'livenessSessions',
  MESSAGES: 'messages',
  OAUTH_STATE: 'oauthState',
};

let store;
function getStore() {
  if (store) return store;
  if (env.store.driver === 'kv') {
    if (!env.store.upstashUrl || !env.store.upstashToken) {
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
    philsysId: '1234-5678-9012',
    identityVerified: true,
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    birthDate: '1990-05-14',
    sex: 'M',
    email: 'juan.delacruz@example.ph',
    phone: '+639170000000',
    address: 'Sampaloc, Manila',
    benefits: { philhealth: { active: true, memberId: 'PH-0001' }, whiteCard: { active: true }, sss: { active: false } },
    createdAt: now,
    updatedAt: now,
  };
  await s.create(COLLECTIONS.PATIENTS, patient);

  // A lab record from ANOTHER hospital, already anchored → powers the "no repeat labs" badge.
  await s.create(COLLECTIONS.RECORDS, {
    id: 'rec_demo_cbc',
    patientId: patient.id,
    type: 'lab',
    title: 'Complete Blood Count (CBC)',
    sourceFacility: 'Ospital ng Maynila',
    encrypted: null,
    summary: 'CBC within normal limits; mild anemia noted.',
    anchor: { hash: '0xseeded_demo_hash', txHash: '0xseeded_demo_tx', anchoredAt: now, verified: true },
    createdAt: now,
    updatedAt: now,
  });

  logger.info('demo data seeded', { patientId: patient.id });
  return patient;
}

module.exports = { getStore, COLLECTIONS, seedDemoData };
