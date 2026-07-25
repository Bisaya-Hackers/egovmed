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
  allowMockInProduction: bool(process.env.ALLOW_MOCK_IN_PRODUCTION, false),

  store: {
    driver: (process.env.STORE_DRIVER || 'memory').toLowerCase(),
    // Accept either Upstash-standard names or the Vercel-KV-marketplace variants (with an optional
    // integration prefix like UPSTASH_REDIS_REST_) so `vercel-add-integration` "just works" without
    // manual env-var renaming.
    upstashUrl:
      process.env.UPSTASH_REDIS_REST_URL
      || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL
      || process.env.KV_REST_API_URL
      || '',
    upstashToken:
      process.env.UPSTASH_REDIS_REST_TOKEN
      || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN
      || process.env.KV_REST_API_TOKEN
      || '',
  },

  globalMode: GLOBAL_MODE,

  egovph: {
    mode: modeFor('EGOVPH'),
    // SSO host (per apidocumentation/eGovPH-SSO-API.md). Token endpoint: {baseUrl}/api/token
    baseUrl: process.env.EGOVPH_BASE_URL || 'https://hackathon-sso.e.gov.ph',
    partnerCode: process.env.EGOVPH_PARTNER_CODE || process.env.EGOVPH_CLIENT_ID || '',
    partnerSecret: process.env.EGOVPH_PARTNER_SECRET || process.env.EGOVPH_CLIENT_SECRET || '',
    scope: process.env.EGOVPH_SCOPE || 'SSO_AUTHENTICATION',
    launchUrl: process.env.EGOVPH_LAUNCH_URL || '',
  },
  egovAi: {
    mode: modeFor('EGOV_AI'),
    // per apidocumentation/eGov-AI-API.md: POST /api/v1/egov/integration/token (access_code) → Bearer, then /ai_assistant/generate
    baseUrl: process.env.EGOV_AI_BASE_URL || '',
    accessCode: process.env.EGOV_AI_ACCESS_CODE || '',
    category: process.env.EGOV_AI_CATEGORY || 'PH',
  },
  everify: {
    mode: modeFor('EVERIFY'),
    // NIDAS eVerify (per apidocumentation/eVerify-NationalID-API.md): /api/auth → /api/query
    baseUrl: process.env.EVERIFY_BASE_URL || 'https://hackathon-everify-api.e.gov.ph',
    clientId: process.env.EVERIFY_CLIENT_ID || '',
    clientSecret: process.env.EVERIFY_CLIENT_SECRET || '',
    pubKey: process.env.EVERIFY_PUBKEY || '', // eVerify liveness widget public key (client-side; optional)
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
    // per apidocumentation/eMessage-API.md: POST /messaging/v1/sms/push, X-EMESSAGE-Auth header
    baseUrl: process.env.EMESSAGE_BASE_URL || 'https://ws-message.e.gov.ph',
    authToken: process.env.EMESSAGE_AUTH_TOKEN || process.env.EMESSAGE_API_KEY || '',
    senderId: process.env.EMESSAGE_SENDER_ID || 'eGovMed',
  },
  egovChain: {
    mode: modeFor('EGOVCHAIN'),
    // per apidocumentation/eGovChain-API.md: Hyperledger Besu QBFT, zero-fee (gasPrice 0), chainId 13371
    rpcUrl: process.env.EGOVCHAIN_RPC_URL || 'https://hackathon-blockchain.e.gov.ph',
    chainId: int(process.env.EGOVCHAIN_CHAIN_ID, 13371),
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
    // per apidocumentation/eReport-API.md: POST /api/integration/token (access_code) → submit_complaint; view via X-EReport-View-Token
    baseUrl: process.env.EREPORT_BASE_URL || '',
    accessCode: process.env.EREPORT_ACCESS_CODE || '',
    reportType: process.env.EREPORT_TYPE || 'red_tape',
    viewToken: process.env.EREPORT_VIEW_TOKEN || '', // OTP-confirmed report_view_token (for status lookups)
    location: {
      regionCode: process.env.EREPORT_REGION_CODE || '',
      provinceCode: process.env.EREPORT_PROVINCE_CODE || '',
      municipalityCode: process.env.EREPORT_MUNICIPALITY_CODE || '',
      barangayCode: process.env.EREPORT_BARANGAY_CODE || '',
    },
    escalateAfterHours: int(process.env.EREPORT_ESCALATE_AFTER_HOURS, 48),
  },
};

function warnIfMisconfigured(log) {
  const weakJwtSecrets = new Set(['dev-insecure-secret-change-me', 'change-me-to-a-long-random-string']);
  if (env.isProd && (weakJwtSecrets.has(env.jwtSecret) || env.jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters in production.');
  }
  if (env.isProd && env.phiKey.length < 32) {
    throw new Error('PHI_ENCRYPTION_KEY must be a stable secret of at least 32 characters in production.');
  } else if (!env.phiKey) {
    log.warn('PHI_ENCRYPTION_KEY is not set — health records will use an ephemeral key (records will not decrypt across restarts).');
  }
  if (env.isProd && env.store.driver !== 'kv') {
    throw new Error('STORE_DRIVER=kv is required in production so PHI and rate limits persist across instances.');
  } else if (env.store.driver === 'memory') {
    log.warn('STORE_DRIVER=memory — data will NOT persist across serverless invocations. Use STORE_DRIVER=kv on Vercel.');
  }
  if (env.isProd && env.store.driver === 'kv' && (!env.store.upstashUrl || !env.store.upstashToken)) {
    throw new Error('Upstash credentials are required when STORE_DRIVER=kv in production.');
  }
  if (env.isProd && env.appUrl === '*') {
    throw new Error('APP_URL must be an explicit trusted origin in production.');
  }
  if (env.isProd && env.adminKey && env.adminKey.length < 32) {
    throw new Error('ADMIN_KEY must be at least 32 characters when configured in production.');
  }
  if (env.isProd && !env.allowMockInProduction) {
    // All eight eGov integrations must be live + credentialed once the mock escape hatch is off.
    // A silent mock in production could serve fake triage, identity, or payment data to a real citizen.
    const requirements = [
      [env.egovph.mode === 'live' && env.egovph.partnerCode && env.egovph.partnerSecret, 'eGovPH SSO'],
      [env.everify.mode === 'live' && env.everify.clientId && env.everify.clientSecret, 'eVerify'],
      [env.faceLiveness.mode === 'live' && env.faceLiveness.apiKey, 'Face Liveness'],
      [env.egovPay.mode === 'live' && env.egovPay.token, 'eGovPay'],
      [env.eMessage.mode === 'live' && env.eMessage.authToken, 'eMessage'],
      [env.eReport.mode === 'live' && env.eReport.accessCode
        && env.eReport.location.regionCode && env.eReport.location.provinceCode
        && env.eReport.location.municipalityCode && env.eReport.location.barangayCode, 'eReport'],
      [env.egovChain.mode === 'live' && env.egovChain.contractAddress && env.egovChain.privateKey, 'eGovChain'],
      [env.egovAi.mode === 'live' && env.egovAi.accessCode && env.egovAi.baseUrl, 'eGov AI'],
    ];
    const missing = requirements.filter(([ok]) => !ok).map(([, name]) => name);
    if (missing.length) {
      throw new Error(`Production cannot use mock or uncredentialed integrations: ${missing.join(', ')}. Set ALLOW_MOCK_IN_PRODUCTION=true only for an explicit non-live demo.`);
    }
  }
}

function publicUrl(base, path) {
  return `${String(base || '').replace(/\/$/, '')}/${String(path || '').replace(/^\//, '')}`;
}

module.exports = { env, bool, int, publicUrl, warnIfMisconfigured };
