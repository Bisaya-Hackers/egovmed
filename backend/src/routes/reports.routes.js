'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { rateLimit, requireAuth, requireAdmin, validate, asyncHandler } = require('../middleware');
const reportService = require('../services/reportService');

const router = Router();
// EGM-YYYY-###### is the mock (self-generated) format; PFM-MMDDYY-#### is the live eReport
// format (portal docs: e.g. PFM-071826-0014). Accept either so live lookups don't 404 after flip.
const caseParams = z.object({
  caseNumber: z.string().regex(/^(EGM-\d{4}-\d{6}|PFM-\d{6}-\d{4})$/),
}).strict();
const adminLimit = rateLimit({ scope: 'admin', max: 10, windowMs: 15 * 60_000, key: (req) => req.ip });

// POST /reports  { category, description, contact? } → { caseNumber, status }
router.post('/', requireAuth,
  rateLimit({ scope: 'report-create', max: 10, windowMs: 10 * 60_000 }),
  validate(z.object({
    category: z.string().trim().min(2).max(100),
    description: z.string().trim().min(3).max(5000),
    contact: z.string().trim().min(3).max(254).optional(),
  }).strict()),
  asyncHandler(async (req, res) => {
    res.status(201).json(await reportService.fileReport({ patientId: req.user.sub, ...req.body }));
  }));

// GET /reports → the caller's own reports, newest first. Declared before /:caseNumber so the
// bare path can never be read as a case number. Summary rows only, no decrypted description.
router.get('/', requireAuth,
  rateLimit({ scope: 'report-list', max: 60, windowMs: 60_000 }),
  asyncHandler(async (req, res) => {
    res.json({ reports: await reportService.listForPatient(req.user.sub) });
  }));

// GET /reports/:caseNumber → track a case (owner-scoped)
router.get('/:caseNumber', requireAuth,
  validate(caseParams, 'params'),
  rateLimit({ scope: 'report-status', max: 30, windowMs: 10 * 60_000 }), asyncHandler(async (req, res) => {
  res.json(await reportService.getByCase(req.params.caseNumber, req.user.sub));
}));

// POST /reports/escalate-stale → escalation sweep. ADMIN/cron only (x-admin-key), NOT a patient action.
// requireAdmin runs FIRST so an unauthenticated caller cannot drain the shared 'admin' rate-limit
// bucket and lock a real operator out of this route (see /integrations/status for the same pattern).
router.post('/escalate-stale', requireAdmin, adminLimit, asyncHandler(async (_req, res) => {
  res.json({ escalated: await reportService.escalateStale() });
}));

// GET /reports/insights/recurring → cross-tenant analytics. ADMIN only (x-admin-key).
router.get('/insights/recurring', requireAdmin, adminLimit, asyncHandler(async (_req, res) => {
  res.json(await reportService.recurringErrors());
}));

module.exports = router;
