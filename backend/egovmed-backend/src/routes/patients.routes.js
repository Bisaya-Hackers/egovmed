'use strict';
const { Router } = require('express');
const { requireAuth, asyncHandler } = require('../middleware');
const { getStore, COLLECTIONS } = require('../store');
const { notFound } = require('../lib/errors');

const router = Router();

// GET /patients/me → the authenticated patient's profile
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const store = getStore();
  const patient = await store.findById(COLLECTIONS.PATIENTS, req.user.sub);
  if (!patient) throw notFound('Patient not found');
  res.json(patient);
}));

module.exports = router;
