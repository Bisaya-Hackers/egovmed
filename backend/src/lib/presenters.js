'use strict';
const { SUPPORTED_BENEFIT_KEYS } = require('../services/paymentService');

/** Minimum patient shape safe to return to the citizen client. */
const { env } = require('../config/env');
const everifyIsLive = () => env.everify.mode === 'live';

const publicPatient = (p) => ({
  id: p.id,
  firstName: p.firstName,
  middleName: p.middleName,
  lastName: p.lastName,
  suffix: p.suffix,
  sex: p.sex,
  birthDate: p.birthDate,
  email: p.email,
  phone: p.phone,
  nationality: p.nationality,
  identityVerified: !!p.identityVerified,
  // Demographics feed eVerify's PhilSys query, so they must stay correctable until a REAL match
  // has confirmed them. A seeded/mock 'verified' proves nothing, so it must not lock the fields —
  // otherwise the demo patient is frozen as Juan Dela Cruz with no way to fix it. Server-decided
  // so the client never has to reimplement the rule.
  demographicsLocked: everifyIsLive() && !!p.identityVerified,
  benefits: Object.fromEntries(SUPPORTED_BENEFIT_KEYS.map((key) => [key, !!p.benefits?.[key]?.active])),
});

module.exports = { publicPatient };
