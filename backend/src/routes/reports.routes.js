'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireAdmin, validate, asyncHandler } = require('../middleware');
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

// GET /reports/:caseNumber → track a case (owner-scoped)
router.get('/:caseNumber', requireAuth, asyncHandler(async (req, res) => {
  res.json(await reportService.getByCase(req.params.caseNumber, req.user.sub));
}));

// POST /reports/escalate-stale → escalation sweep. ADMIN/cron only (x-admin-key), NOT a patient action.
router.post('/escalate-stale', requireAdmin, asyncHandler(async (_req, res) => {
  res.json({ escalated: await reportService.escalateStale() });
}));

// GET /reports/insights/recurring → cross-tenant analytics. ADMIN only (x-admin-key).
router.get('/insights/recurring', requireAdmin, asyncHandler(async (_req, res) => {
  res.json(await reportService.recurringErrors());
}));

module.exports = router;
