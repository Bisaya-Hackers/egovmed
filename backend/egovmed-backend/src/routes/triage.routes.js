'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, validate, asyncHandler } = require('../middleware');
const triageService = require('../services/triageService');

const router = Router();

// POST /triage  { text, language? }  → { specialty, urgency, redFlags, ... }
router.post('/', requireAuth,
  validate(z.object({ text: z.string().min(2).max(4000), language: z.string().optional() })),
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

// POST /triage/:id/confirm  { confirmedSpecialty?, note? }  → nurse confirmation
router.post('/:id/confirm', requireAuth,
  validate(z.object({ confirmedSpecialty: z.string().optional(), note: z.string().optional() })),
  asyncHandler(async (req, res) => {
    res.json(await triageService.confirmByNurse(req.params.id, req.body));
  }));

module.exports = router;
