'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { rateLimit, validate, asyncHandler } = require('../middleware');
const authService = require('../services/authService');
const { env, publicUrl } = require('../config/env');

const router = Router();

// Safe public flow metadata; never exposes partner credentials.
router.get('/config', (_req, res) => {
  res.json({
    mode: env.egovph.mode === 'live' ? 'live' : 'mock',
    callbackUrl: publicUrl(env.appUrl, '/egovph/sso'),
    launchUrl: env.egovph.launchUrl || null,
  });
});

// POST /auth/egov/exchange  { exchangeCode }  → { token, patient }
// Primary SSO login: backend swaps the eGov exchange code for a token, pulls the profile,
// upserts the patient, and returns an eGovMed session JWT.
router.post('/egov/exchange',
  rateLimit({ scope: 'auth-exchange', max: 10, windowMs: 5 * 60_000, key: (req) => req.ip }),
  validate(z.object({ exchangeCode: z.string().trim().min(1).max(2048) }).strict()),
  asyncHandler(async (req, res) => {
    res.json(await authService.loginWithExchangeCode(req.body.exchangeCode));
  }));

// POST /auth/token  { accessToken }  → { token, patient }
// For clients that already hold an eGov SSO access token (e.g. via the eGov app SDK).
router.post('/token',
  rateLimit({ scope: 'auth-token', max: 10, windowMs: 5 * 60_000, key: (req) => req.ip }),
  validate(z.object({ accessToken: z.string().trim().min(5).max(8192) }).strict()),
  asyncHandler(async (req, res) => {
    res.json(await authService.loginWithAccessToken(req.body.accessToken));
  }));

module.exports = router;
