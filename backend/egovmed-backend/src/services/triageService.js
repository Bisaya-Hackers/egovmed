'use strict';
const egovAi = require('../integrations/egovAi');
const { getStore, COLLECTIONS } = require('../store');
const { randomId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');

async function runTriage({ patientId, text, language = 'auto' }) {
  const store = getStore();
  let patientContext = {};
  if (patientId) {
    const patient = await store.findById(COLLECTIONS.PATIENTS, patientId);
    if (patient) patientContext = { age: ageFrom(patient.birthDate), sex: patient.sex };
  }

  const result = await egovAi.classifySymptoms({ text, language, patientContext });

  const record = {
    id: randomId('tri_'),
    patientId: patientId || null,
    inputSymptoms: text,
    language,
    specialty: result.specialty,
    urgency: result.urgency,
    redFlags: result.redFlags,
    summaryEn: result.summaryEn,
    reasoning: result.reasoning,
    recommendedAction: result.recommendedAction,
    confidence: result.confidence,
    engine: result.engine,
    nurseConfirmed: false, // decision support only — a nurse confirms
    createdAt: new Date().toISOString(),
  };
  await store.create(COLLECTIONS.TRIAGE, record);
  return record;
}

async function listForPatient(patientId) {
  const store = getStore();
  return (await store.findAll(COLLECTIONS.TRIAGE, (t) => t.patientId === patientId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function confirmByNurse(triageId, { confirmedSpecialty, note } = {}) {
  const store = getStore();
  const t = await store.findById(COLLECTIONS.TRIAGE, triageId);
  if (!t) throw notFound('Triage result not found');
  return store.update(COLLECTIONS.TRIAGE, triageId, {
    nurseConfirmed: true,
    confirmedSpecialty: confirmedSpecialty || t.specialty,
    nurseNote: note || null,
  });
}

function ageFrom(birthDate) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 864e5));
}

module.exports = { runTriage, listForPatient, confirmByNurse };
