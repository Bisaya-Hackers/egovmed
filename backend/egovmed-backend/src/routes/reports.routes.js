'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, validate, asyncHandler } = require('../middleware');
const reportService = require('../services/reportService');

const router = Router();

// POST /reports  { category, description, contact? } → { caseNumber, status }
router.post('/', requireAuth,
  validate(z.object({
    category: z.string(),
    description: z.string().min(3),
    contact: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    res.status(201).json(await reportService.fileReport({ patientId: req.user.sub, ...req.body }));
  }));

// GET /reports/:caseNumber → track a case
router.get('/:caseNumber', requireAuth, asyncHandler(async (req, res) => {
  res.json(await reportService.getByCase(req.params.caseNumber));
}));

// POST /reports/escalate-stale → run the escalation sweep (cron/scheduled)
router.post('/escalate-stale', requireAuth, asyncHandler(async (_req, res) => {
  res.json({ escalated: await reportService.escalateStale() });
}));

// GET /reports/insights/recurring → recurring-error feedback signal for triage
router.get('/insights/recurring', requireAuth, asyncHandler(async (_req, res) => {
  res.json(await reportService.recurringErrors());
}));

module.exports = router;
