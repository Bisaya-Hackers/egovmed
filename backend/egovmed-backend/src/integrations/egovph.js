'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');
const { upstream } = require('../lib/errors');

const cfg = env.egovph;
const isLive = () => cfg.mode === 'live';

/**
 * eGov App SSO (v2) — real flow, per https://e.gov.ph/developers
 *
 *  Step 1  POST {baseUrl}/api/token           (multipart form-data)
 *            partner_code, partner_secret, scope=SSO_AUTHENTICATION, exchange_code
 *          → { access_token }
 *          The exchange_code originates in the eGov super app and is handed to the
 *          partner app. (Sandbox lets you simulate it with your registered eGov account.)
 *
 *  Step 2  POST {baseUrl}/api/partner/sso_authentication   (Bearer access_token)
 *          → { status, message, data: { uniqid, first_name, ... } }  ← the citizen profile
 */

/** Step 1: exchange an eGov exchange_code for a scoped access token. */
async function generateAccessToken(exchangeCode, scope = cfg.scope) {
  if (!isLive()) return { access_token: `mock-access-${exchangeCode || 'demo'}` };

  const form = new URLSearchParams({
    partner_code: cfg.partnerCode,
    partner_secret: cfg.partnerSecret,
    scope,
  });
  if (exchangeCode) form.set('exchange_code', exchangeCode);

  const res = await http.post(`${cfg.baseUrl}/api/token`, form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res || !res.access_token) throw upstream('eGov token endpoint returned no access_token', res);
  return res;
}

/** Step 2: fetch the authenticated citizen's profile with an SSO access token. */
async function fetchSsoProfile(accessToken) {
  if (!isLive()) {
    return normalize({
      uniqid: 'MVPCBEUVCGPZR',
      email: 'juan.delacruz@example.ph',
      birth_date: '05/14/1990',
      first_name: 'JUAN',
      middle_name: 'DELA',
      last_name: 'CRUZ',
      suffix: '',
      gender: 'MALE',
      nationality: 'FILIPINO',
      photo: 'https://samplephoto.com',
      mobile: '+639170000000',
      address: 'Sampaloc, Manila',
      region: 'NATIONAL CAPITAL REGION (NCR)',
    });
  }
  const res = await http.post(`${cfg.baseUrl}/api/partner/sso_authentication`, undefined, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = res && (res.data || res);
  if (!data || !data.uniqid) throw upstream('eGov SSO profile response missing data', res);
  return normalize(data);
}

/** Convenience: full SSO login in one call. */
async function loginWithExchangeCode(exchangeCode) {
  const { access_token } = await generateAccessToken(exchangeCode);
  const profile = await fetchSsoProfile(access_token);
  return { accessToken: access_token, profile };
}

/** Convert the eGov `data` object into eGovMed's patient profile shape. */
function normalize(d) {
  return {
    egovSub: d.uniqid,                       // eGov unique id = identity anchor
    firstName: cap(d.first_name),
    middleName: cap(d.middle_name),
    lastName: cap(d.last_name),
    suffix: d.suffix || null,
    birthDate: toIsoDate(d.birth_date),      // MM/DD/YYYY -> YYYY-MM-DD
    sex: d.gender ? String(d.gender).charAt(0).toUpperCase() : null,
    email: (d.email || '').toLowerCase() || null,
    phone: d.mobile || null,
    address: d.address || [d.street, d.barangay, d.municipality, d.province].filter(Boolean).join(', ') || null,
    photo: d.photo || null,
    nationality: d.nationality || null,
    philsysId: null,                         // NOT in SSO payload — obtained separately via eVerify
    raw: d,
  };
}

const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase() : '');
function toIsoDate(mdY) {
  if (!mdY) return null;
  const m = String(mdY).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : mdY;
}

module.exports = { generateAccessToken, fetchSsoProfile, loginWithExchangeCode, isLive };
