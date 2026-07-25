'use strict';
const { Router } = require('express');
const { rateLimit, requireAuth, asyncHandler } = require('../middleware');
const { getStore, COLLECTIONS } = require('../store');
const { notFound } = require('../lib/errors');
const { publicPatient } = require('../lib/presenters');

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

module.exports = router;
