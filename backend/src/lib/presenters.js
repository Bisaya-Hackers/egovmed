'use strict';
const { SUPPORTED_BENEFIT_KEYS } = require('../services/paymentService');

/** Minimum patient shape safe to return to the citizen client. */
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
  benefits: Object.fromEntries(SUPPORTED_BENEFIT_KEYS.map((key) => [key, !!p.benefits?.[key]?.active])),
});

module.exports = { publicPatient };
