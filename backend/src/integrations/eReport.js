'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');

const cfg = env.eReport;
const isLive = () => cfg.mode === 'live' && !!cfg.accessCode && !!cfg.baseUrl;

// per apidocumentation/eReport-API.md — POST /api/integration/token { access_code } → Bearer.
let tokenCache = null;
async function ereportToken() {
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
 * Reads require an OTP-confirmed report_view_token (X-EReport-View-Token) — provided via config.
 */
async function getStatus(caseNumber) {
  if (isLive() && cfg.viewToken) {
    const res = await http.get(`${cfg.baseUrl}/api/integration/reports/${encodeURIComponent(caseNumber)}`, {
      headers: { 'X-EReport-View-Token': cfg.viewToken },
    });
    const data = (res && (res.data || res)) || {};
    return { caseNumber, status: String(data.status || 'PENDING').toLowerCase(), provider: 'ereport' };
  }
  return { caseNumber, status: 'open', provider: 'mock' };
}

module.exports = { fileReport, getStatus, escalateAfterHours: cfg.escalateAfterHours };
