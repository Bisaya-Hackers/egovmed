'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, validate, asyncHandler } = require('../middleware');
const identityService = require('../services/identityService');

const router = Router();

// POST /identity/liveness → create a face-liveness session (frontend runs the capture)
router.post('/liveness', requireAuth, asyncHandler(async (req, res) => {
  res.json(await identityService.startLiveness(req.user.sub));
}));

// POST /identity/verify  { philsysId?, consent, livenessSessionId? }
router.post('/verify', requireAuth,
  validate(z.object({
    philsysId: z.string().optional(),
    consent: z.boolean(),
    livenessSessionId: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    const result = await identityService.verifyIdentity({ patientId: req.user.sub, ...req.body });
    res.json(result);
  }));

module.exports = router;
