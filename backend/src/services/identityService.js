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

const LIVENESS_MAX_AGE_MS = 10 * 60 * 1000; // a captured liveness session is valid for 10 minutes

/** Verify PhilSys identity (with consent + a fresh, single-use liveness session) and flip patient.identityVerified. */
async function verifyIdentity({ patientId, philsysId, consent, livenessSessionId, requestMeta = {} }) {
  const store = getStore();
  const patient = await store.findById(COLLECTIONS.PATIENTS, patientId);
  if (!patient) throw notFound('Patient not found');
  if (!consent) throw badRequest('Consent is required to verify identity');

  // Face-liveness is a REQUIRED, patient-bound, single-use, time-limited step-up (anti-abuse).
  if (!livenessSessionId) throw badRequest('A face-liveness session is required');
  const livenessSession = await store.findById(COLLECTIONS.LIVENESS, livenessSessionId);
  if (!livenessSession || livenessSession.patientId !== patientId) throw badRequest('Invalid or mismatched liveness session');
  if (livenessSession.status !== 'created') throw badRequest('Liveness session already used — please re-capture');
  if (Date.now() - new Date(livenessSession.createdAt).getTime() > LIVENESS_MAX_AGE_MS) {
    await store.update(COLLECTIONS.LIVENESS, livenessSessionId, { status: 'expired' });
    throw badRequest('Liveness session expired — please re-capture');
  }

  const liveness = await identity.getLivenessResult(livenessSessionId);
  // getLivenessResult already enforces "SUCCEEDED" + confidence >= threshold in live mode.
  if (!liveness.live) {
    await store.update(COLLECTIONS.LIVENESS, livenessSessionId, { status: 'failed' });
    throw badRequest('Face-liveness check failed');
  }
  // Consume the session so a passed capture can't be replayed.
  await store.update(COLLECTIONS.LIVENESS, livenessSessionId, { status: 'consumed', consumedAt: new Date().toISOString() });

  // Persist an auditable consent receipt (Data Privacy Act 2012).
  const consentRecord = {
    id: randomId('con_'),
    patientId,
    purpose: 'identity_verification',
    granted: true,
    grantedAt: new Date().toISOString(),
    livenessSessionId,
    context: { userAgent: requestMeta.userAgent || null, ip: requestMeta.ip || null },
  };
  await store.create(COLLECTIONS.CONSENTS, consentRecord);

  const result = await identity.verifyPhilSys({
    firstName: patient.firstName,
    middleName: patient.middleName,
    lastName: patient.lastName,
    suffix: patient.suffix,
    birthDate: patient.birthDate,          // YYYY-MM-DD
    faceLivenessSessionId: livenessSessionId,
    consent,
  });

  const verification = {
    id: randomId('ver_'),
    patientId,
    verified: result.verified,
    score: result.score,
    reference: result.reference,
    liveness: { confidence: liveness.confidence, provider: liveness.provider },
    livenessSessionId,
    consentId: consentRecord.id,
    provider: result.provider,
    createdAt: new Date().toISOString(),
  };
  await store.create(COLLECTIONS.VERIFICATIONS, verification);

  if (result.verified) {
    await store.update(COLLECTIONS.PATIENTS, patientId, {
      identityVerified: true, philsysId: philsysId || patient.philsysId,
    });
  }
  return { verified: result.verified, verification, consentId: consentRecord.id };
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
