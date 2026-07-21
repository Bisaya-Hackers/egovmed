'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');
const { upstream } = require('../lib/errors');

const cfg = env.egovph;
const isLive = () => cfg.mode === 'live';

/**
 * eGovPH SSO — real flow, per apidocumentation/eGovPH-SSO-API.md
 *
 *  Step 1  POST {baseUrl}/api/token           (JSON body)
 *            { exchange_code, scope: "SSO_AUTHENTICATION", partner_code, partner_secret }
 *          → { access_token }
 *          The exchange_code is single-use, originates in the eGov super app, and is
 *          appended to the partner's redirect URL (?exchange_code=...).
 *
 *  Step 2  POST {baseUrl}/api/partner/sso_authentication   (Bearer access_token, no body)
 *          → the citizen profile (uniqid, name, birthdate, contact, address, …)
 */

/** Step 1: exchange an eGov exchange_code for a scoped access token. */
async function generateAccessToken(exchangeCode, scope = cfg.scope) {
  if (!isLive()) return { access_token: `mock-access-${exchangeCode || 'demo'}` };

  const res = await http.post(`${cfg.baseUrl}/api/token`, {
    exchange_code: exchangeCode,
    scope,
    partner_code: cfg.partnerCode,
    partner_secret: cfg.partnerSecret,
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
