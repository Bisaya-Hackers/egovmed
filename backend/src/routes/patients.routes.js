'use strict';
const { Router } = require('express');
const { rateLimit, requireAuth, asyncHandler } = require('../middleware');
const { getStore, COLLECTIONS } = require('../store');
const { notFound, badRequest } = require('../lib/errors');
const { publicPatient } = require('../lib/presenters');
const { SUPPORTED_BENEFIT_KEYS } = require('../services/paymentService');

const router = Router();

// GET /patients/me → the authenticated patient's profile
router.get('/me', requireAuth,
  rateLimit({ scope: 'patients-me', max: 60, windowMs: 60_000 }),
  asyncHandler(async (req, res) => {
    const store = getStore();
    const patient = await store.findById(COLLECTIONS.PATIENTS, req.user.sub);
    if (!patient) throw notFound('Patient not found');
    res.json(publicPatient(patient));
  }));

// PATCH /patients/me/benefits/:key → activate one of the benefit programs the eGovPay benefit
// engine actually knows how to compute against a bill (see paymentService.BENEFIT_RULES).
// SUPPORTED_BENEFIT_KEYS is derived straight from BENEFIT_RULES so the two can't drift —
// anything not in BENEFIT_RULES stays a frontend-only "coming soon" entry rather than silently
// flipping a flag the payment math never reads.
const benefitLimit = rateLimit({ scope: 'benefits-activate', max: 20, windowMs: 10 * 60_000 });
router.patch('/me/benefits/:key', requireAuth, benefitLimit, asyncHandler(async (req, res) => {
  const { key } = req.params;
  // Static message + typed details field — never reflect the raw URL param into the response
  // message string. errorHandler surfaces details to clients but the message text stays constant,
  // so a caller passing "%3Cscript%3E" cannot see their input echoed back.
  if (!SUPPORTED_BENEFIT_KEYS.includes(key)) {
    throw badRequest('Unsupported benefit', [{ path: 'key', message: `must be one of: ${SUPPORTED_BENEFIT_KEYS.join(', ')}` }]);
  }
  const store = getStore();
  const patient = await store.findById(COLLECTIONS.PATIENTS, req.user.sub);
  if (!patient) throw notFound('Patient not found');
  const benefits = { ...(patient.benefits || {}), [key]: { ...(patient.benefits?.[key] || {}), active: true } };
  const updated = await store.update(COLLECTIONS.PATIENTS, req.user.sub, { benefits });
  res.json(publicPatient(updated));
}));

module.exports = router;
