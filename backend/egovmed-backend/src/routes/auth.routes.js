'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { validate, asyncHandler } = require('../middleware');
const authService = require('../services/authService');

const router = Router();

// POST /auth/egov/exchange  { exchangeCode }  → { token, patient }
// Primary SSO login: backend swaps the eGov exchange code for a token, pulls the profile,
// upserts the patient, and returns an eGovMed session JWT.
router.post('/egov/exchange',
  validate(z.object({ exchangeCode: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    res.json(await authService.loginWithExchangeCode(req.body.exchangeCode));
  }));

// POST /auth/token  { accessToken }  → { token, patient }
// For clients that already hold an eGov SSO access token (e.g. via the eGov app SDK).
router.post('/token',
  validate(z.object({ accessToken: z.string().min(5) })),
  asyncHandler(async (req, res) => {
    res.json(await authService.loginWithAccessToken(req.body.accessToken));
  }));

module.exports = router;
