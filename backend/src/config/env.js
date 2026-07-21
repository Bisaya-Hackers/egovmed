'use strict';
require('dotenv').config();

const bool = (v, d = false) => (v == null ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const int = (v, d) => {
  if (v == null || v === '') return d;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d; // never let a malformed value (NaN) leak into config
};

const GLOBAL_MODE = (process.env.INTEGRATION_MODE || 'mock').toLowerCase();
// Per-integration mode: explicit *_MODE wins, otherwise fall back to the global switch.
const modeFor = (name) => (process.env[`${name}_MODE`] || GLOBAL_MODE).toLowerCase();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: int(process.env.PORT, 4000),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiPublicUrl: process.env.API_PUBLIC_URL || `http://localhost:${int(process.env.PORT, 4000)}`,

  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  sessionTtl: Math.max(1, int(process.env.SESSION_TTL, 86400)), // must be positive → valid jwt expiresIn
  phiKey: process.env.PHI_ENCRYPTION_KEY || '',
  adminKey: process.env.ADMIN_KEY || '', // gates operational routes (escalation sweep, insights)

  store: {
    driver: (process.env.STORE_DRIVER || 'memory').toLowerCase(),
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL || '',
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },

  globalMode: GLOBAL_MODE,

  egovph: {
    mode: modeFor('EGOVPH'),
    // SSO host (per apidocumentation/eGovPH-SSO-API.md). Token endpoint: {baseUrl}/api/token
    baseUrl: process.env.EGOVPH_BASE_URL || 'https://hackathon-sso.e.gov.ph',
    partnerCode: process.env.EGOVPH_PARTNER_CODE || process.env.EGOVPH_CLIENT_ID || '',
    partnerSecret: process.env.EGOVPH_PARTNER_SECRET || process.env.EGOVPH_CLIENT_SECRET || '',
    scope: process.env.EGOVPH_SCOPE || 'SSO_AUTHENTICATION',
  },
  egovAi: {
    mode: modeFor('EGOV_AI'),
    baseUrl: process.env.EGOV_AI_BASE_URL || 'https://ai.egov.ph',
    apiKey: process.env.EGOV_AI_API_KEY || '',
    model: process.env.EGOV_AI_MODEL || 'egov-ai-default',
  },
  everify: {
    mode: modeFor('EVERIFY'),
    // NIDAS eVerify (per apidocumentation/eVerify-NationalID-API.md): /api/auth → /api/query
    baseUrl: process.env.EVERIFY_BASE_URL || 'https://hackathon-everify-api.e.gov.ph',
    clientId: process.env.EVERIFY_CLIENT_ID || '',
    clientSecret: process.env.EVERIFY_CLIENT_SECRET || '',
  },
  faceLiveness: {
    mode: modeFor('FACE_LIVENESS'),
    // per apidocumentation/Face-Liveness-API.md: x-api-key auth, hosted session → result flow
    baseUrl: process.env.FACE_LIVENESS_BASE_URL || 'https://hackathon-face-liveness-api.e.gov.ph',
    apiKey: process.env.FACE_LIVENESS_API_KEY || '',
    action: process.env.FACE_LIVENESS_ACTION || 'redirect',
    callbackUrl: process.env.FACE_LIVENESS_CALLBACK_URL || '',
    minConfidence: int(process.env.FACE_LIVENESS_MIN_CONFIDENCE, 95),
  },
  eMessage: {
    mode: modeFor('EMESSAGE'),
    baseUrl: process.env.EMESSAGE_BASE_URL || 'https://message.egov.ph',
    apiKey: process.env.EMESSAGE_API_KEY || '',
    senderId: process.env.EMESSAGE_SENDER_ID || 'eGovMed',
  },
  egovChain: {
    mode: modeFor('EGOVCHAIN'),
    rpcUrl: process.env.EGOVCHAIN_RPC_URL || '',
    chainId: int(process.env.EGOVCHAIN_CHAIN_ID, undefined),
    contractAddress: process.env.EGOVCHAIN_CONTRACT_ADDRESS || '',
    privateKey: process.env.EGOVCHAIN_PRIVATE_KEY || '',
  },
  egovPay: {
    mode: modeFor('EGOVPAY'),
    // per apidocumentation/eGovPay-API.md: POST /api/v1/transaction with X-eGovPay-Token + HMAC digest
    baseUrl: process.env.EGOVPAY_BASE_URL || 'https://pay.egov.ph', // set to the eGovPay host from onboarding
    token: process.env.EGOVPAY_TOKEN || process.env.EGOVPAY_API_KEY || '', // X-eGovPay-Token (test_-prefixed in test mode)
    settlementTemplateUuid: process.env.EGOVPAY_SETTLEMENT_TEMPLATE_UUID || '',
    redirectUrl: process.env.EGOVPAY_REDIRECT_URL || '',
    callbackUrl: process.env.EGOVPAY_CALLBACK_URL || '',
    merchantId: process.env.EGOVPAY_MERCHANT_ID || '',
  },
  eReport: {
    mode: modeFor('EREPORT'),
    baseUrl: process.env.EREPORT_BASE_URL || 'https://report.egov.ph',
    apiKey: process.env.EREPORT_API_KEY || '',
    escalateAfterHours: int(process.env.EREPORT_ESCALATE_AFTER_HOURS, 48),
  },
};

function warnIfMisconfigured(log) {
  if (env.isProd && env.jwtSecret === 'dev-insecure-secret-change-me') {
    // Forgeable tokens = full account/PHI takeover. Refuse to start rather than warn.
    throw new Error('JWT_SECRET must be set to a strong secret in production (refusing to start with the insecure default).');
  }
  if (!env.phiKey) {
    log.warn('PHI_ENCRYPTION_KEY is not set — health records will use an ephemeral key (records will not decrypt across restarts).');
  }
  if (env.store.driver === 'memory') {
    log.warn('STORE_DRIVER=memory — data will NOT persist across serverless invocations. Use STORE_DRIVER=kv on Vercel.');
  }
}

module.exports = { env, bool, int, warnIfMisconfigured };
