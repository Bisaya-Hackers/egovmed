'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, validate, asyncHandler } = require('../middleware');
const recordService = require('../services/recordService');
const identityService = require('../services/identityService');
const auditService = require('../services/auditService');

const requestMeta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

const router = Router();
const idParams = z.object({ id: z.string().regex(/^rec_[A-Za-z0-9_-]{1,100}$/) }).strict();

// GET /records → patient's records (identity-gated)
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  await identityService.assertVerified(req.user.sub);
  const records = await recordService.listRecords(req.user.sub);
  await auditService.log({ actorId: req.user.sub, patientId: req.user.sub, action: 'records.list', resourceType: 'health_record', requestMeta: requestMeta(req) });
  res.json(records);
}));

// POST /records  { type, title, sourceFacility?, data?, summary? }  (identity-gated, like reads)
router.post('/', requireAuth,
  validate(z.object({
    type: z.string().trim().min(2).max(50),
    title: z.string().trim().min(2).max(200),
    sourceFacility: z.string().trim().min(2).max(200).optional(),
    data: z.union([z.record(z.unknown()), z.array(z.unknown())]).optional(),
    summary: z.string().trim().max(2000).optional(),
  }).strict()),
  asyncHandler(async (req, res) => {
    await identityService.assertVerified(req.user.sub);
    const record = await recordService.createRecord({ patientId: req.user.sub, ...req.body });
    await auditService.log({ actorId: req.user.sub, patientId: req.user.sub, action: 'records.create', resourceType: 'health_record', resourceId: record.id, requestMeta: requestMeta(req) });
    res.status(201).json(record);
  }));

// GET /records/:id/verify → "Lab result verified from another hospital ✓" (ownership-scoped)
router.get('/:id/verify', requireAuth, validate(idParams, 'params'), asyncHandler(async (req, res) => {
  const result = await recordService.verifyRecord(req.params.id, req.user.sub);
  await auditService.log({ actorId: req.user.sub, patientId: req.user.sub, action: 'records.verify', resourceType: 'health_record', resourceId: req.params.id, requestMeta: requestMeta(req) });
  res.json(result);
}));

// GET /records/doctor-summary → AI history summary + verified labs (no repeat labs)
router.get('/doctor-summary', requireAuth, asyncHandler(async (req, res) => {
  await identityService.assertVerified(req.user.sub);
  const summary = await recordService.buildDoctorSummary(req.user.sub);
  await auditService.log({ actorId: req.user.sub, patientId: req.user.sub, action: 'records.doctor_summary', resourceType: 'health_record', requestMeta: requestMeta(req) });
  res.json(summary);
}));

// GET /records/:id → single record incl. decrypted PHI values (ownership-scoped, 404 on mismatch)
router.get('/:id', requireAuth, validate(idParams, 'params'), asyncHandler(async (req, res) => {
  await identityService.assertVerified(req.user.sub);
  const record = await recordService.getRecord(req.params.id, { includeData: true, patientId: req.user.sub });
  await auditService.log({ actorId: req.user.sub, patientId: req.user.sub, action: 'records.read', resourceType: 'health_record', resourceId: req.params.id, requestMeta: requestMeta(req) });
  res.json(record);
}));

module.exports = router;
