'use strict';
const eReport = require('../integrations/eReport');
const { getStore, COLLECTIONS } = require('../store');
const { randomId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');

async function fileReport({ patientId, category, description, contact }) {
  const store = getStore();
  const filed = await eReport.fileReport({ category, description, patientId, contact });
  const report = {
    id: randomId('rep_'),
    patientId: patientId || null,
    category,
    description,
    caseNumber: filed.caseNumber,
    status: filed.status,
    escalated: false,
    escalateAfterHours: eReport.escalateAfterHours,
    createdAt: new Date().toISOString(),
  };
  await store.create(COLLECTIONS.REPORTS, report);
  return report;
}

async function getByCase(caseNumber, requesterId) {
  const store = getStore();
  const report = await store.findOne(COLLECTIONS.REPORTS, (r) => r.caseNumber === caseNumber);
  // Case numbers are guessable (EGM-YYYY-######); scope to the owner. 404 (not 403) hides existence.
  if (!report || (requesterId && report.patientId !== requesterId)) throw notFound('Case not found');
  const upstream = await eReport.getStatus(caseNumber).catch(() => null);
  if (upstream && upstream.status && upstream.status !== report.status) {
    return store.update(COLLECTIONS.REPORTS, report.id, { status: upstream.status });
  }
  return report;
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

module.exports = { fileReport, getByCase, escalateStale, recurringErrors };
