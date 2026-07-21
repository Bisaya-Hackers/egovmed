'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');

const cfg = env.eReport;

async function fileReport({ category, description, patientId, contact }) {
  if (cfg.mode === 'live' && cfg.apiKey) {
    // NOTE: confirm payload with eReport docs (issue filing is OTP-verified upstream).
    const res = await http.post(`${cfg.baseUrl}/v1/reports`, {
      category, description, reporter_ref: patientId, contact,
    }, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
    return { caseNumber: res.case_number, status: res.status || 'open', provider: 'ereport' };
  }
  const caseNumber = `EGM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  return { caseNumber, status: 'open', provider: 'mock' };
}

async function getStatus(caseNumber) {
  if (cfg.mode === 'live' && cfg.apiKey) {
    const res = await http.get(`${cfg.baseUrl}/v1/reports/${caseNumber}`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    return { caseNumber, status: res.status, provider: 'ereport' };
  }
  return { caseNumber, status: 'open', provider: 'mock' };
}

module.exports = { fileReport, getStatus, escalateAfterHours: cfg.escalateAfterHours };
