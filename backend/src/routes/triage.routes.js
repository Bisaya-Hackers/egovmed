'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireAdmin, validate, asyncHandler } = require('../middleware');
const triageService = require('../services/triageService');
const { SPECIALTIES } = require('../integrations/egovAi');

const router = Router();

// POST /triage  { text, language? }  → { specialty, urgency, redFlags, ... }
router.post('/', requireAuth,
  validate(z.object({
    text: z.string().trim().min(2).max(4000),
    language: z.enum(['auto', 'en', 'tl', 'taglish']).optional(),
  })),
  asyncHandler(async (req, res) => {
    const result = await triageService.runTriage({
      patientId: req.user.sub, text: req.body.text, language: req.body.language,
    });
    res.status(201).json(result);
  }));

// GET /triage → the patient's triage history
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json(await triageService.listForPatient(req.user.sub));
}));

// POST /triage/:id/confirm  { confirmedSpecialty?, note? }  → CLINICIAN-ONLY nurse confirmation.
// Decision-support integrity: a nurse confirms every result; patients must NOT self-confirm.
router.post('/:id/confirm', requireAdmin,
  validate(z.object({ confirmedSpecialty: z.enum(SPECIALTIES).optional(), note: z.string().max(1000).optional() })),
  asyncHandler(async (req, res) => {
    res.json(await triageService.confirmByNurse(req.params.id, req.body));
  }));

module.exports = router;
