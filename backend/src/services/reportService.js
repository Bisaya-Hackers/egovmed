'use strict';
const eReport = require('../integrations/eReport');
const { getStore, COLLECTIONS } = require('../store');
const { randomId, encryptJson, decryptJson } = require('../lib/crypto');
const { notFound } = require('../lib/errors');

async function fileReport({ patientId, category, description, contact }) {
  const store = getStore();
  const patient = patientId ? await store.findById(COLLECTIONS.PATIENTS, patientId) : null;
  const filed = await eReport.fileReport({ category, description, patient: patient || {}, contact: contact || patient?.phone });
  const report = {
    id: randomId('rep_'),
    patientId: patientId || null,
    category,
    encryptedVersion: 1,
    encrypted: encryptJson({ description }),
    caseNumber: filed.caseNumber,
    status: filed.status,
    escalated: false,
    escalateAfterHours: eReport.escalateAfterHours,
    createdAt: new Date().toISOString(),
  };
  await store.create(COLLECTIONS.REPORTS, report);
  return present(report);
}

/**
 * A patient's own reports, newest first. Deliberately does NOT decrypt `description` — the list
 * only needs to get you to a case number, and the detail view (getByCase) is where the narrative
 * belongs. Keeps N encrypted PHI blobs from being decrypted just to render a list.
 */
async function listForPatient(patientId) {
  const store = getStore();
  const mine = await store.findAll(COLLECTIONS.REPORTS, (r) => r.patientId === patientId);
  return mine
    .map(({ id, caseNumber, category, status, escalated, createdAt }) => ({ id, caseNumber, category, status, escalated, createdAt }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getByCase(caseNumber, requesterId) {
  const store = getStore();
  const report = await store.findOne(COLLECTIONS.REPORTS, (r) => r.caseNumber === caseNumber);
  // Case numbers are guessable (EGM-YYYY-######); scope to the owner. 404 (not 403) hides existence.
  if (!report || (requesterId && report.patientId !== requesterId)) throw notFound('Case not found');
  const upstream = await eReport.getStatus(caseNumber).catch(() => null);
  if (upstream && upstream.status && upstream.status !== report.status) {
    return present(await store.update(COLLECTIONS.REPORTS, report.id, { status: upstream.status }));
  }
  return present(report);
}

/** Auto-escalate any open case past its time threshold. Call from a cron / scheduled function. */
async function escalateStale() {
  const store = getStore();
  const open = await store.findAll(COLLECTIONS.REPORTS, (r) => r.status === 'open' && !r.escalated);
  const now = Date.now();
  const escalated = [];
  for (const r of open) {
    const ageHours = (now - new Date(r.createdAt).getTime()) / 36e5;
    if (ageHours >= r.escalateAfterHours) {
      escalated.push(await store.update(COLLECTIONS.REPORTS, r.id, { escalated: true, status: 'escalated' }));
    }
  }
  return escalated;
}

/** Mine recurring issue categories → feedback signal to retrain/adjust triage. */
async function recurringErrors() {
  const store = getStore();
  const all = await store.findAll(COLLECTIONS.REPORTS);
  const counts = {};
  for (const r of all) counts[r.category] = (counts[r.category] || 0) + 1;
  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function present(report) {
  if (report?.encryptedVersion === 1 && report.encrypted) {
    const { encrypted, encryptedVersion, ...rest } = report;
    return { ...rest, ...decryptJson(encrypted) };
  }
  return report;
}

module.exports = { fileReport, listForPatient, getByCase, escalateStale, recurringErrors };
