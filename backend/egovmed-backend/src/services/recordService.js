'use strict';
const chain = require('../integrations/egovChain');
const egovAi = require('../integrations/egovAi');
const triageService = require('./triageService');
const { getStore, COLLECTIONS } = require('../store');
const { sha256Hex, encryptJson, decryptJson, randomId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');

/**
 * Create a health record: PHI is encrypted OFF-CHAIN; only the sha256 fingerprint is
 * anchored on eGovChain. This is what makes labs from other hospitals trustable → no repeat labs.
 */
async function createRecord({ patientId, type, title, sourceFacility, data, summary }) {
  const store = getStore();
  const now = new Date().toISOString();
  const hash = sha256Hex({ patientId, type, title, sourceFacility, data });
  const anchor = await chain.anchorHash(hash, { patientId, type, title });

  const record = {
    id: randomId('rec_'),
    patientId,
    type, // 'lab' | 'vitals' | 'history' | 'imaging' | ...
    title,
    sourceFacility: sourceFacility || 'PGH',
    encrypted: data ? encryptJson(data) : null,
    summary: summary || null,
    anchor,
    createdAt: now,
    updatedAt: now,
  };
  await store.create(COLLECTIONS.RECORDS, record);
  return present(record);
}

async function listRecords(patientId) {
  const store = getStore();
  const records = await store.findAll(COLLECTIONS.RECORDS, (r) => r.patientId === patientId);
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(present);
}

async function getRecord(id, { includeData = false } = {}) {
  const store = getStore();
  const record = await store.findById(COLLECTIONS.RECORDS, id);
  if (!record) throw notFound('Record not found');
  const view = present(record);
  if (includeData && record.encrypted) view.data = decryptJson(record.encrypted);
  return view;
}

/** Confirm a record's on-chain anchor → drives the "Lab result verified from another hospital ✓" badge. */
async function verifyRecord(id) {
  const store = getStore();
  const record = await store.findById(COLLECTIONS.RECORDS, id);
  if (!record) throw notFound('Record not found');
  const result = await chain.verifyAnchor(record.anchor?.hash, record.anchor?.txHash);
  return {
    recordId: id,
    title: record.title,
    sourceFacility: record.sourceFacility,
    verified: result.verified,
    badge: result.verified ? `Lab result verified from ${record.sourceFacility} ✓` : 'Unverified',
    anchor: record.anchor,
  };
}

/** Doctor view: AI-summarized history + verified labs (so labs aren't repeated). */
async function buildDoctorSummary(patientId) {
  const [records, triage] = await Promise.all([
    listRecords(patientId),
    triageService.listForPatient(patientId),
  ]);
  const summary = await egovAi.summarizeHistory({ records, triage });
  const verifiedLabs = records.filter((r) => r.type === 'lab' && r.anchor?.verified);
  return { summary, verifiedLabs, recordCount: records.length, triageCount: triage.length };
}

function present(r) {
  const { encrypted, ...rest } = r;
  return { ...rest, hasData: !!encrypted };
}

module.exports = { createRecord, listRecords, getRecord, verifyRecord, buildDoctorSummary };
