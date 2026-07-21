'use strict';
const chain = require('../integrations/egovChain');
const egovAi = require('../integrations/egovAi');
const triageService = require('./triageService');
const { getStore, COLLECTIONS } = require('../store');
const { sha256Hex, encryptJson, decryptJson, randomId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');

/** Canonical content hash of a record — recomputed at verify time to prove the off-chain data is untampered. */
function contentHash(record, data) {
  return sha256Hex({
    patientId: record.patientId,
    type: record.type,
    title: record.title,
    sourceFacility: record.sourceFacility,
    data: data === undefined ? (record.encrypted ? decryptJson(record.encrypted) : null) : data,
  });
}

/**
 * Create a health record: PHI is encrypted OFF-CHAIN; only the sha256 fingerprint is
 * anchored on eGovChain. This is what makes labs from other hospitals trustable → no repeat labs.
 */
async function createRecord({ patientId, type, title, sourceFacility, data, summary }) {
  const store = getStore();
  const now = new Date().toISOString();
  const hash = sha256Hex({ patientId, type, title, sourceFacility: sourceFacility || 'PGH', data: data ?? null });
  // Only a non-identifying record-type tag goes to the anchor — never patientId/title (see egovChain.js).
  const anchor = await chain.anchorHash(hash, { type });

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

// Ownership-scoped single-record read. 404 (not 403) on mismatch so record existence isn't disclosed.
async function getRecord(id, { includeData = false, patientId } = {}) {
  const store = getStore();
  const record = await store.findById(COLLECTIONS.RECORDS, id);
  if (!record) throw notFound('Record not found');
  if (patientId && record.patientId !== patientId) throw notFound('Record not found');
  const view = present(record);
  if (includeData && record.encrypted) view.data = decryptJson(record.encrypted);
  return view;
}

/**
 * Confirm a record is untampered AND anchored → drives the "verified from another hospital ✓" badge.
 * Real tamper-evidence: recompute the content hash NOW and compare to the anchored hash — a badge is
 * only shown when the off-chain data still matches the fingerprint on eGovChain.
 */
async function verifyRecord(id, patientId) {
  const store = getStore();
  const record = await store.findById(COLLECTIONS.RECORDS, id);
  if (!record) throw notFound('Record not found');
  if (patientId && record.patientId !== patientId) throw notFound('Record not found');

  let integrityOk = false;
  try {
    integrityOk = contentHash(record) === record.anchor?.hash;
  } catch { integrityOk = false; }
  const onChain = await chain.verifyAnchor(record.anchor?.hash, record.anchor?.txHash);
  const verified = integrityOk && onChain.verified;

  return {
    recordId: id,
    title: record.title,
    sourceFacility: record.sourceFacility,
    verified,
    integrityOk,
    anchoredOnChain: onChain.verified,
    badge: verified ? `Lab result verified from ${record.sourceFacility} ✓` : 'Unverified',
    anchor: record.anchor,
  };
}

/** Doctor view: AI-summarized history + labs that RE-verify against the anchor (not the create-time flag). */
async function buildDoctorSummary(patientId) {
  const [records, triage] = await Promise.all([
    listRecords(patientId),
    triageService.listForPatient(patientId),
  ]);
  const summary = await egovAi.summarizeHistory({ records, triage });
  const verifiedLabs = [];
  for (const lab of records.filter((r) => r.type === 'lab')) {
    const v = await verifyRecord(lab.id, patientId);
    if (v.verified) verifiedLabs.push({ id: lab.id, title: lab.title, sourceFacility: lab.sourceFacility });
  }
  return { summary, verifiedLabs, recordCount: records.length, triageCount: triage.length };
}

function present(r) {
  const { encrypted, ...rest } = r;
  return { ...rest, hasData: !!encrypted };
}

module.exports = { createRecord, listRecords, getRecord, verifyRecord, buildDoctorSummary };
