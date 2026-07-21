// Thin client for the eGovMed backend. Base URL from VITE_API_BASE_URL (default /api, proxied in dev).
// The session token from login is attached as a Bearer on every authed call.
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

let token = null;
export function setToken(t) { token = t; }
export function getToken() { return token; }

async function req(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error((data && data.error && data.error.message) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // eGovPH SSO — mock exchange-code login (backend runs in mock mode → returns a seeded patient + JWT).
  login: () => req('/auth/egov/exchange', { method: 'POST', body: { exchangeCode: 'demo' } }),
  me: () => req('/patients/me'),
  // eGovAI triage
  triage: (text, language) => req('/triage', { method: 'POST', body: { text, language: language === 'tl' ? 'tl' : 'en' } }),
  // National ID eVerify + Face Liveness
  startLiveness: () => req('/identity/liveness', { method: 'POST', body: {} }),
  verifyIdentity: (livenessSessionId) => req('/identity/verify', { method: 'POST', body: { consent: true, livenessSessionId } }),
  // Appointments + eMessage
  book: (specialty, scheduledFor, triageId) => req('/appointments', { method: 'POST', body: { specialty, scheduledFor, triageId } }),
  appointments: () => req('/appointments'),
  // eGovPay (benefits mock-labeled by the backend)
  quote: (billAmount) => req('/payments/quote', { method: 'POST', body: { billAmount } }),
  pay: (billAmount) => req('/payments', { method: 'POST', body: { billAmount } }),
  // eGovChain-anchored records
  records: () => req('/records'),
  // eReport
  fileReport: (category, description) => req('/reports', { method: 'POST', body: { category, description } }),
  trackCase: (caseNumber) => req(`/reports/${encodeURIComponent(caseNumber)}`),
};

export { BASE };
