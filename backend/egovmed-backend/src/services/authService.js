'use strict';
const egovph = require('../integrations/egovph');
const { getStore, COLLECTIONS } = require('../store');
const { sign } = require('../lib/jwt');
const { randomId } = require('../lib/crypto');

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
  let patient = await store.findOne(COLLECTIONS.PATIENTS, (p) => p.egovSub === profile.egovSub);

  const fields = {
    egovSub: profile.egovSub,
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    suffix: profile.suffix,
    birthDate: profile.birthDate,
    sex: profile.sex,
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    photo: profile.photo,
    nationality: profile.nationality,
  };

  if (patient) {
    patient = await store.update(COLLECTIONS.PATIENTS, patient.id, fields);
  } else {
    patient = await store.create(COLLECTIONS.PATIENTS, {
      id: randomId('pat_'),
      ...fields,
      philsysId: null,          // set later by eVerify
      identityVerified: false,  // flips true after eVerify + liveness
      benefits: { philhealth: { active: false }, whiteCard: { active: false }, sss: { active: false } },
      createdAt: now,
      updatedAt: now,
    });
  }

  const token = sign({ sub: patient.id, egovSub: patient.egovSub, name: `${patient.firstName} ${patient.lastName}`.trim() });
  return { token, patient };
}

module.exports = { loginWithExchangeCode, loginWithAccessToken };
