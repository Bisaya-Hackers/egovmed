'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, validate, asyncHandler } = require('../middleware');
const recordService = require('../services/recordService');
const identityService = require('../services/identityService');

const router = Router();

// GET /records → patient's records (identity-gated)
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  await identityService.assertVerified(req.user.sub);
  res.json(await recordService.listRecords(req.user.sub));
}));

// POST /records  { type, title, sourceFacility?, data?, summary? }
router.post('/', requireAuth,
  validate(z.object({
    type: z.string(),
    title: z.string(),
    sourceFacility: z.string().optional(),
    data: z.any().optional(),
    summary: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    const record = await recordService.createRecord({ patientId: req.user.sub, ...req.body });
    res.status(201).json(record);
  }));

// GET /records/:id/verify → "Lab result verified from another hospital ✓"
router.get('/:id/verify', requireAuth, asyncHandler(async (req, res) => {
  res.json(await recordService.verifyRecord(req.params.id));
}));

// GET /records/doctor-summary → AI history summary + verified labs (no repeat labs)
router.get('/doctor-summary', requireAuth, asyncHandler(async (req, res) => {
  await identityService.assertVerified(req.user.sub);
  res.json(await recordService.buildDoctorSummary(req.user.sub));
}));

module.exports = router;
