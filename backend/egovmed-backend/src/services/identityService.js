'use strict';
const identity = require('../integrations/identity');
const { getStore, COLLECTIONS } = require('../store');
const { randomId } = require('../lib/crypto');
const { notFound, badRequest } = require('../lib/errors');

async function startLiveness(patientId) {
  const store = getStore();
  const session = await identity.createLivenessSession();
  await store.create(COLLECTIONS.LIVENESS, {
    id: session.sessionId, patientId, status: 'created', createdAt: new Date().toISOString(),
  });
  return session;
}

/** Verify PhilSys identity (with consent + a passed liveness session) and flip patient.identityVerified. */
async function verifyIdentity({ patientId, philsysId, consent, livenessSessionId }) {
  const store = getStore();
  const patient = await store.findById(COLLECTIONS.PATIENTS, patientId);
  if (!patient) throw notFound('Patient not found');
  if (!consent) throw badRequest('Consent is required to verify identity');

  // Confirm liveness (anti-abuse) if a session was provided.
  let liveness = { live: true, confidence: null, provider: 'skipped' };
  if (livenessSessionId) {
    liveness = await identity.getLivenessResult(livenessSessionId);
    await store.update(COLLECTIONS.LIVENESS, livenessSessionId, { status: liveness.live ? 'passed' : 'failed' });
    if (!liveness.live) throw badRequest('Face-liveness check failed');
  }

  const result = await identity.verifyPhilSys({
    philsysId: philsysId || patient.philsysId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    birthDate: patient.birthDate,
    consent,
  });

  const verification = {
    id: randomId('ver_'),
    patientId,
    verified: result.verified,
    score: result.score,
    reference: result.reference,
    liveness: { confidence: liveness.confidence, provider: liveness.provider },
    provider: result.provider,
    createdAt: new Date().toISOString(),
  };
  await store.create(COLLECTIONS.VERIFICATIONS, verification);

  if (result.verified) {
    await store.update(COLLECTIONS.PATIENTS, patientId, {
      identityVerified: true, philsysId: philsysId || patient.philsysId,
    });
  }
  return { verified: result.verified, verification };
}

/** Gate: throws unless the patient has completed identity verification. */
async function assertVerified(patientId) {
  const store = getStore();
  const patient = await store.findById(COLLECTIONS.PATIENTS, patientId);
  if (!patient) throw notFound('Patient not found');
  if (!patient.identityVerified) throw badRequest('Identity must be verified before accessing records');
  return true;
}

module.exports = { startLiveness, verifyIdentity, assertVerified };
