'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { rateLimit, requireAuth, validate, asyncHandler } = require('../middleware');
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

// PATCH /patients/me → let the citizen correct their own contact fields.
//
// Motivation: eGovPH SSO is the source of truth for identity, but the `mobile` field on the
// SSO profile may be missing or stale. Without a user-editable phone, eMessage in live mode
// would silently fail to deliver appointment confirmations to anyone whose SSO record lacks
// a number. Same rationale for email.
//
// Only contact fields are editable here. Names / DOB / sex / nationality all come from
// PhilSys via SSO and are load-bearing for identity matching — those must not be user-editable.
// Benefits have their own PATCH route below.
//
// SSO overwrite caveat: authService.upsertAndIssue currently prefers any non-empty phone/email
// returned by SSO on subsequent logins (see the "Don't overwrite previously-good fields with
// blanks/nulls from a thinner SSO payload" comment there). So a user-set phone STICKS if SSO
// returns blank on later logins, but gets overwritten if SSO returns any value. That's fine for
// the "SSO omitted phone" use case this endpoint exists to solve; a full "manual override
// beats SSO" would need per-field provenance tracking — deferred.
const updateLimit = rateLimit({ scope: 'patients-update', max: 20, windowMs: 10 * 60_000 });
// E.164 Philippine mobile: +63 + 10 digits. Stored canonical so integration adapters don't
// each guess a format; eReport's fileReport already strips the leading + at send time.
const PH_MOBILE = /^\+63\d{10}$/;
const updateBody = z.object({
  phone: z.string().trim().regex(PH_MOBILE, 'phone must be +63 followed by 10 digits').optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
}).strict().refine((o) => o.phone !== undefined || o.email !== undefined, {
  message: 'At least one of phone or email must be provided',
});
router.patch('/me', requireAuth, updateLimit,
  validate(updateBody),
  asyncHandler(async (req, res) => {
    const store = getStore();
    const patient = await store.findById(COLLECTIONS.PATIENTS, req.user.sub);
    if (!patient) throw notFound('Patient not found');
    const patch = { updatedAt: new Date().toISOString() };
    if (req.body.phone !== undefined) patch.phone = req.body.phone;
    if (req.body.email !== undefined) patch.email = req.body.email;
    const updated = await store.update(COLLECTIONS.PATIENTS, req.user.sub, patch);
    res.json(publicPatient(updated));
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
