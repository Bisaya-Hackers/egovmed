// Thin client for the eGovMed backend. Base URL from VITE_API_BASE_URL (default /api, proxied in dev).
// The session token from login is attached as a Bearer on every authed call.
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const SESSION_KEY = 'egovmed.session';
let token = typeof window !== 'undefined' ? window.sessionStorage.getItem(SESSION_KEY) : null;
export function setToken(t) {
  token = t || null;
  if (typeof window === 'undefined') return;
  if (token) window.sessionStorage.setItem(SESSION_KEY, token);
  else window.sessionStorage.removeItem(SESSION_KEY);
}
export function getToken() { return token; }

async function req(path, { method = 'GET', body, timeoutMs } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Backend configuration request timed out');
    throw err;
  } finally {
    if (timer) window.clearTimeout(timer);
  }
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
  authConfig: () => req('/auth/config', { timeoutMs: 2000 }),
  // In live mode the exchange code comes from the eGovPH redirect query string.
  login: (exchangeCode = 'demo') => req('/auth/egov/exchange', { method: 'POST', body: { exchangeCode } }),
  me: () => req('/patients/me'),
  // eGovAI triage
  triage: (text, language) => req('/triage', { method: 'POST', body: { text, language: language === 'tl' ? 'tl' : 'en' } }),
  // National ID eVerify + Face Liveness
  startLiveness: () => req('/identity/liveness', { method: 'POST', body: {} }),
  verifyIdentity: (livenessSessionId) => req('/identity/verify', { method: 'POST', body: { consent: true, livenessSessionId } }),
  // Appointments + eMessage
  book: (specialty, scheduledFor, triageId) => req('/appointments', {
    method: 'POST', body: { specialty, ...(scheduledFor ? { scheduledFor } : {}), ...(triageId ? { triageId } : {}) },
  }),
  appointments: () => req('/appointments'),
  messages: () => req('/messages'),
  // eGovPay (benefits mock-labeled by the backend)
  quote: (billAmount) => req('/payments/quote', { method: 'POST', body: { billAmount } }),
  pay: (billAmount, channel) => req('/payments', { method: 'POST', body: { billAmount, channel } }),
  paymentStatus: (billId) => req(`/payments/${encodeURIComponent(billId)}/status`),
  // eGovChain-anchored records
  records: () => req('/records'),
  getRecord: (id) => req(`/records/${encodeURIComponent(id)}`),
  verifyRecord: (id) => req(`/records/${encodeURIComponent(id)}/verify`),
  doctorSummary: () => req('/records/doctor-summary'),
  // eReport
  fileReport: (category, description) => req('/reports', { method: 'POST', body: { category, description } }),
  trackCase: (caseNumber) => req(`/reports/${encodeURIComponent(caseNumber)}`),
};

export { BASE };
