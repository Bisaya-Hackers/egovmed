'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');

const cfg = env.eReport;
const isLive = () => cfg.mode === 'live';

// per apidocumentation/eReport-API.md — POST /api/integration/token { access_code } → Bearer.
let tokenCache = null;
async function ereportToken() {
  if (!cfg.accessCode || !cfg.baseUrl) throw new Error('eReport live mode requires base URL and access code');
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5000) return tokenCache.token;
  const res = await http.post(`${cfg.baseUrl}/api/integration/token`, { access_code: cfg.accessCode });
  const token = res && res.access_token;
  if (!token) throw new Error('eReport token endpoint returned no access_token');
  tokenCache = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

/**
 * File a complaint → POST /api/integration/submit_complaint (Bearer). Requires complainant details
 * + PSA location codes (from config). `report_type` is a fixed eReport enum (default from cfg); our
 * routing/billing/etc. category rides along as the subject.
 */
async function fileReport({ category, description, patient = {}, contact }) {
  if (isLive()) {
    const token = await ereportToken();
    const res = await http.post(`${cfg.baseUrl}/api/integration/submit_complaint`, {
      mobile: String(patient.phone || contact || '').replace(/^\+/, ''),
      first_name: patient.firstName || 'eGovMed',
      last_name: patient.lastName || 'Patient',
      gender: patient.sex === 'F' ? 'Female' : 'Male',
      complainant_email: patient.email || contact || 'noreply@egovmed.ph',
      // eReport enum. Default 'red_tape' predates portal docs — real valid values come from
      // GET /api/integration/datasets/report_types (portal docs show 'crime' as an example).
      // Confirm the enum for health-facility complaints with the eGov admin before flipping.
      report_type: cfg.reportType,
      subject: category,
      message: description,
      region_code: cfg.location.regionCode,
      province_code: cfg.location.provinceCode,
      municipality_code: cfg.location.municipalityCode,
      barangay_code: cfg.location.barangayCode,
    }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    return { caseNumber: res.case_number, status: 'open', provider: 'ereport' };
  }
  const caseNumber = `EGM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  return { caseNumber, status: 'open', provider: 'mock' };
}

/**
 * Track a case → GET /api/integration/reports/:case_number.
 *
 * IMPORTANT (portal docs, 2026-07): the view token model is per-complainant AND time-limited.
 * Flow: submit_complaint → returns case_number only (no token).
 *       Later, POST /verify/request { email } → OTP sent.
 *       POST /verify/confirm { email, otp } → returns { report_view_token, expires_at }.
 *       GET /api/integration/reports/:case_number with `Authorization: Bearer <report_view_token>`.
 *
 * The single env-wide EREPORT_VIEW_TOKEN cannot satisfy arbitrary complainants — this live path
 * only works for the specific complainant whose OTP minted the token, and only until expires_at.
 * Correct fix for MVP (per handoff option A): drop status auto-track, show the case number and
 * tell the patient to check on eReport directly. Kept here as-is until that UX decision lands.
 * Auth header is Bearer (docs), NOT the X-EReport-View-Token that was previously assumed.
 */
async function getStatus(caseNumber) {
  if (isLive() && cfg.viewToken) {
    const res = await http.get(`${cfg.baseUrl}/api/integration/reports/${encodeURIComponent(caseNumber)}`, {
      headers: { Authorization: `Bearer ${cfg.viewToken}` },
    });
    const data = (res && (res.data || res)) || {};
    return { caseNumber, status: String(data.status || 'PENDING').toLowerCase(), provider: 'ereport' };
  }
  // mock / unconfigured has no real opinion on status — return null rather than a hardcoded
  // 'open' so reportService never mistakes "we don't know" for an authoritative status and
  // overwrites a locally-escalated case back to open on the patient's next status check.
  return { caseNumber, status: null, provider: 'mock' };
}

module.exports = { fileReport, getStatus, escalateAfterHours: cfg.escalateAfterHours };
