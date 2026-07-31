'use strict';
const egovph = require('../integrations/egovph');
const { getStore, COLLECTIONS, seedDemoContentFor } = require('../store');
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
    // A field the patient manually corrected via PATCH /patients/me stays theirs — SSO can still
    // fill in fields it never touched, but it can't clobber a deliberate fix with a stale value.
    const overridden = new Set(patient.manuallyOverriddenFields || []);
    const patch = Object.fromEntries(Object.entries(fields).filter(([key]) => !overridden.has(key)));
    patient = await store.update(COLLECTIONS.PATIENTS, patient.id, patch);
  } else {
    patient = await store.create(COLLECTIONS.PATIENTS, {
      id: patientIdFor(profile.egovSub),
      egovSub: profile.egovSub,
      ...fields,
      identityVerified: false,  // flips true after eVerify + liveness
      manuallyOverriddenFields: [],
      benefits: { philhealth: { active: false }, whiteCard: { active: false }, sss: { active: false } },
      createdAt: now,
      updatedAt: now,
    });
    // Mock SSO now hands every device its own uniqid, so this branch runs for each new demo
    // visitor rather than once ever. A brand-new patient owns no records and no benefits, which
    // would leave the Records screen and the eGovPay step — the two things the demo is built
    // around — empty for everyone but the one seeded patient. Give them their own copy instead.
    // Mock-only and creation-only: a live SSO signup gets exactly the row it always did.
    if (isDemoPatient) patient = (await seedDemoContentFor(patient.id)) || patient;
  }

  const token = sign({ sub: patient.id });
  if (!isDemoPatient) return { token, patient: publicPatient(patient) };

  // Mock/demo mode has no real citizen behind it. Each device now gets its own demo patient, so
  // this no longer stops one visitor's data reaching another — it stops a *returning* visitor
  // inheriting the leftovers of their own previous run, which in a persistent KV store pile up
  // forever. Wipe just those four transactional collections (never PATIENTS or the seeded
  // RECORDS/benefits) on every fresh mock login, so each demo run starts clean — the same
  // "resets every time" experience the in-memory local store gives for free.
  // REPORTS belongs here specifically because "Your reports" on the track screen lists them by
  // patient: without this, a demo run opens on a list of case numbers from the last one.
  await Promise.all(
    [COLLECTIONS.APPOINTMENTS, COLLECTIONS.PAYMENTS, COLLECTIONS.MESSAGES, COLLECTIONS.REPORTS].map(async (collection) => {
      const rows = await store.findAll(collection, (r) => r.patientId === patient.id);
      await Promise.all(rows.map((r) => store.remove(collection, r.id)));
    }),
  );

  return { token, patient: publicPatient(patient) };
}

module.exports = { loginWithExchangeCode, loginWithAccessToken };
