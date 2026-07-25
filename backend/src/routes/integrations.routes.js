'use strict';
const { Router } = require('express');
const { rateLimit, requireAdmin, asyncHandler } = require('../middleware');
const { env } = require('../config/env');

const router = Router();
const adminLimit = rateLimit({ scope: 'admin', max: 10, windowMs: 15 * 60_000, key: (req) => req.ip });

// Admin-only. Returns per-integration mode + boolean credential presence + baseUrl.
// NEVER returns secret values — mirrors the /auth/config no-credentials assertion in security.test.js.
// The purpose is to make the mock→live rollout observable without reading Vercel env vars.
router.get('/status', adminLimit, requireAdmin, asyncHandler(async (_req, res) => {
  res.json({
    globalMode: env.globalMode,
    allowMockInProduction: env.allowMockInProduction,
    integrations: {
      egovph: {
        mode: env.egovph.mode,
        baseUrl: env.egovph.baseUrl,
        hasCredentials: !!(env.egovph.partnerCode && env.egovph.partnerSecret),
        launchUrlConfigured: !!env.egovph.launchUrl,
      },
      egovAi: {
        mode: env.egovAi.mode,
        baseUrl: env.egovAi.baseUrl,
        hasCredentials: !!env.egovAi.accessCode,
      },
      everify: {
        mode: env.everify.mode,
        baseUrl: env.everify.baseUrl,
        hasCredentials: !!(env.everify.clientId && env.everify.clientSecret),
        pubKeyConfigured: !!env.everify.pubKey,
      },
      faceLiveness: {
        mode: env.faceLiveness.mode,
        baseUrl: env.faceLiveness.baseUrl,
        hasCredentials: !!env.faceLiveness.apiKey,
      },
      eMessage: {
        mode: env.eMessage.mode,
        baseUrl: env.eMessage.baseUrl,
        hasCredentials: !!env.eMessage.authToken,
      },
      egovChain: {
        mode: env.egovChain.mode,
        baseUrl: env.egovChain.rpcUrl,
        hasCredentials: !!(env.egovChain.contractAddress && env.egovChain.privateKey),
        contractAddressConfigured: !!env.egovChain.contractAddress,
      },
      egovPay: {
        mode: env.egovPay.mode,
        baseUrl: env.egovPay.baseUrl,
        hasCredentials: !!(env.egovPay.token && env.egovPay.settlementTemplateUuid),
      },
      eReport: {
        mode: env.eReport.mode,
        baseUrl: env.eReport.baseUrl,
        hasCredentials: !!env.eReport.accessCode,
        locationConfigured: !!(env.eReport.location.regionCode
          && env.eReport.location.provinceCode
          && env.eReport.location.municipalityCode
          && env.eReport.location.barangayCode),
      },
    },
  });
}));

module.exports = router;
