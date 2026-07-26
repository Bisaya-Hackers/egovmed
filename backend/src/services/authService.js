'use strict';
const egovph = require('../integrations/egovph');
const { getStore, COLLECTIONS } = require('../store');
const { sign } = require('../lib/jwt');
const { sha256Hex } = require('../lib/crypto');
const { publicPatient } = require('../lib/presenters');
const { env } = require('../config/env');

// Deterministic patient id from the eGov uniqid → a concurrent first login can't create two rows.
const patientIdFor = (egovSub) => 'pat_' + sha256Hex('egovsub:' + egovSub).slice(2, 22);

/**
 * Log a citizen in via the eGov SSO exchange-code flow:
 *   exchange_code → access_token (/api/token) → profile (/api/partner/sso_authentication)
 */
async function loginWithExchangeCode(exchangeCode) {
  const { profile } = await egovph.loginWithExchangeCode(exchangeCode);
  return upsertAndIssue(profile);
}

/**
 * Alternate path: the client (e.g. eGov app SDK) already holds an SSO access token.
 * We just call sso_authentication with it.
 */
async function loginWithAccessToken(accessToken) {
  const profile = await egovph.fetchSsoProfile(accessToken);
  return upsertAndIssue(profile);
}

/** Create-or-update the Patient keyed on the eGov uniqid, then mint a session JWT. */
async function upsertAndIssue(profile) {
  const store = getStore();
  const now = new Date().toISOString();
  // Only true when this login came from the mock eGovPH branch (config-driven, never
  // client-controlled) — real live SSO logins always keep their history.
  const isDemoPatient = env.egovph.mode !== 'live';
  let patient = await store.findOne(COLLECTIONS.PATIENTS, (p) => p.egovSub === profile.egovSub);

  const incoming = {
    egovSub: profile.egovSub,
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    suffix: profile.suffix,
    birthDate: profile.birthDate,
    sex: profile.sex,
    email: profile.email,
    phone: profile.phone,
    nationality: profile.nationality,
  };
  // Don't overwrite previously-good fields with blanks/nulls from a thinner SSO payload.
  const fields = Object.fromEntries(Object.entries(incoming).filter(([, v]) => v !== null && v !== undefined && v !== ''));

  if (patient) {
    patient = await store.update(COLLECTIONS.PATIENTS, patient.id, fields);
  } else {
    patient = await store.create(COLLECTIONS.PATIENTS, {
      id: patientIdFor(profile.egovSub),
      egovSub: profile.egovSub,
      ...fields,
      identityVerified: false,  // flips true after eVerify + liveness
      benefits: { philhealth: { active: false }, whiteCard: { active: false }, sss: { active: false } },
      createdAt: now,
      updatedAt: now,
    });
  }

  const token = sign({ sub: patient.id });
  if (!isDemoPatient) return { token, patient: publicPatient(patient) };

  // Mock/demo mode has no real citizen behind it — it's the same "Juan Dela Cruz" profile for
  // every visitor of the deployed demo. Left alone, appointments/payments/messages booked by
  // one demo session pile up forever in the shared KV store and bleed into the next person's
  // session. Wipe just those three transactional collections (never PATIENTS or the seeded
  // RECORDS/benefits) on every fresh mock login, so each demo run starts clean — the same
  // "resets every time" experience the in-memory local store gives for free.
  await Promise.all(
    [COLLECTIONS.APPOINTMENTS, COLLECTIONS.PAYMENTS, COLLECTIONS.MESSAGES].map(async (collection) => {
      const rows = await store.findAll(collection, (r) => r.patientId === patient.id);
      await Promise.all(rows.map((r) => store.remove(collection, r.id)));
    }),
  );

  return { token, patient: publicPatient(patient) };
}

module.exports = { loginWithExchangeCode, loginWithAccessToken };
