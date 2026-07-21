'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret-0123456789abcdef0123456789abcdef';
process.env.PHI_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.STORE_DRIVER = 'memory';
process.env.INTEGRATION_MODE = 'mock';
process.env.APP_URL = 'http://localhost:3000';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const app = require('../src/app');
const { sign } = require('../src/lib/jwt');
const { getStore, COLLECTIONS, seedDemoData } = require('../src/store');
const { normalizePaymentStatus } = require('../src/integrations/egovPay');

let server;
let baseUrl;
const store = getStore();

const request = (path, { token, method = 'GET', body, rawBody, headers = {} } = {}) =>
  fetch(baseUrl + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined || rawBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });

async function json(response) {
  const value = await response.json();
  return { response, value };
}

async function resetWithPatients() {
  await store.reset();
  const seeded = await seedDemoData();
  await store.create(COLLECTIONS.PATIENTS, {
    id: 'pat_attacker', egovSub: 'attacker-sub', firstName: 'Mallory', lastName: 'Test',
    identityVerified: true, benefits: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  return seeded.id;
}

test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});

test('security regression suite', async (t) => {
  await t.test('eGovPay sandbox payment_status values are normalized', () => {
    assert.equal(normalizePaymentStatus({ payment_status: 'PAID' }), 'paid');
    assert.equal(normalizePaymentStatus({ status: 'SUCCESSFUL' }), 'successful');
    assert.equal(normalizePaymentStatus({ state: 'completed' }), 'completed');
    assert.equal(normalizePaymentStatus({}), 'pending');
  });

  await t.test('security headers are present and framework disclosure is disabled', async () => {
    await resetWithPatients();
    const response = await request('/health');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-powered-by'), null);
  });

  await t.test('login is bounded, strips sensitive patient fields, and query tokens are rejected', async () => {
    await resetWithPatients();
    const login = await json(await request('/auth/egov/exchange', { method: 'POST', body: { exchangeCode: 'demo' } }));
    assert.equal(login.response.status, 200);
    assert.ok(login.value.token);
    assert.equal(login.value.patient.egovSub, undefined);
    assert.equal(login.value.patient.philsysId, undefined);
    assert.equal(login.value.patient.benefits.philhealth, true);

    const queryToken = await request(`/patients/me?token=${encodeURIComponent(login.value.token)}`);
    assert.equal(queryToken.status, 401);
  });

  await t.test('public flow configuration exposes no credentials and payment callbacks are non-authoritative', async () => {
    await resetWithPatients();
    const config = await json(await request('/auth/config'));
    assert.equal(config.response.status, 200);
    assert.deepEqual(config.value, {
      mode: 'mock',
      callbackUrl: 'http://localhost:3000/egovph/sso',
      launchUrl: null,
    });
    assert.equal(JSON.stringify(config.value).includes('secret'), false);

    const callback = await json(await request('/payments/callback', {
      method: 'POST', body: { status: 'paid', bill_id: 'bill_forged' },
    }));
    assert.equal(callback.response.status, 202);
    assert.deepEqual(callback.value, { accepted: true });
    assert.equal((await store.findAll(COLLECTIONS.PAYMENTS)).length, 0);
  });

  await t.test('cross-tenant appointment and payment IDs cannot be read or mutated', async () => {
    const ownerId = await resetWithPatients();
    const owner = sign({ sub: ownerId });
    const attacker = sign({ sub: 'pat_attacker' });

    const booked = await json(await request('/appointments', {
      token: owner, method: 'POST', body: { specialty: 'Cardiology' },
    }));
    assert.equal(booked.response.status, 201);
    assert.equal(booked.value.notification.to, undefined);
    assert.equal(booked.value.notification.body, undefined);
    const appointmentId = booked.value.appointment.id;
    assert.equal((await request(`/appointments/${appointmentId}`, { token: attacker, method: 'PATCH', body: { status: 'cancelled' } })).status, 404);
    assert.equal((await request(`/appointments/${appointmentId}/remind`, { token: attacker, method: 'POST' })).status, 404);

    const bill = await json(await request('/payments', { token: owner, method: 'POST', body: { billAmount: 300 } }));
    assert.equal(bill.response.status, 201);
    assert.equal((await request(`/payments/${bill.value.id}/status`, { token: attacker })).status, 404);
    assert.equal((await request(`/payments/${bill.value.id}/status`, { token: owner })).status, 200);
    const messages = await store.findAll(COLLECTIONS.MESSAGES);
    assert.equal(messages[0].to, undefined);
    assert.equal(messages[0].body, undefined);
  });

  await t.test('triage symptoms and report narratives are encrypted at rest', async () => {
    const ownerId = await resetWithPatients();
    const owner = sign({ sub: ownerId });
    const triage = await json(await request('/triage', {
      token: owner, method: 'POST', body: { text: 'I have a mild headache', language: 'en' },
    }));
    assert.equal(triage.response.status, 201);
    assert.equal(triage.value.inputSymptoms, 'I have a mild headache');
    const storedTriage = await store.findById(COLLECTIONS.TRIAGE, triage.value.id);
    assert.equal(storedTriage.inputSymptoms, undefined);
    assert.match(storedTriage.encrypted, /^v1:/);

    const report = await json(await request('/reports', {
      token: owner, method: 'POST', body: { category: 'service', description: 'Sensitive complaint narrative' },
    }));
    assert.equal(report.response.status, 201);
    assert.equal(report.value.description, 'Sensitive complaint narrative');
    const storedReport = await store.findById(COLLECTIONS.REPORTS, report.value.id);
    assert.equal(storedReport.description, undefined);
    assert.match(storedReport.encrypted, /^v1:/);
  });

  await t.test('new record PHI is encrypted at rest and accesses are audited', async () => {
    const ownerId = await resetWithPatients();
    const owner = sign({ sub: ownerId });
    const created = await json(await request('/records', {
      token: owner,
      method: 'POST',
      body: { type: 'lab', title: 'Sensitive Test', sourceFacility: 'PGH', data: { result: 'positive' }, summary: 'Sensitive summary' },
    }));
    assert.equal(created.response.status, 201);
    assert.equal(created.value.summary, 'Sensitive summary');
    const stored = await store.findById(COLLECTIONS.RECORDS, created.value.id);
    assert.equal(stored.title, undefined);
    assert.equal(stored.summary, undefined);
    assert.equal(stored.type, undefined);
    assert.match(stored.encrypted, /^v1:/);
    const audits = await store.findAll(COLLECTIONS.AUDIT_LOGS, (entry) => entry.resourceId === created.value.id);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'records.create');
  });

  await t.test('a liveness session can only be claimed once under concurrent replay', async () => {
    const ownerId = await resetWithPatients();
    const owner = sign({ sub: ownerId });
    const started = await json(await request('/identity/liveness', { token: owner, method: 'POST' }));
    assert.equal(started.response.status, 200);
    const body = { consent: true, livenessSessionId: started.value.sessionId };
    const responses = await Promise.all([
      request('/identity/verify', { token: owner, method: 'POST', body }),
      request('/identity/verify', { token: owner, method: 'POST', body }),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400]);
  });

  await t.test('malformed and oversized JSON are rejected with safe statuses', async () => {
    await resetWithPatients();
    assert.equal((await request('/auth/egov/exchange', { method: 'POST', rawBody: '{' })).status, 400);
    const oversized = JSON.stringify({ exchangeCode: 'x'.repeat(270 * 1024) });
    assert.equal((await request('/auth/egov/exchange', { method: 'POST', rawBody: oversized })).status, 413);
    const tooDeep = `{"exchangeCode":"demo","nested":${'['.repeat(40)}0${']'.repeat(40)}}`;
    assert.equal((await request('/auth/egov/exchange', { method: 'POST', rawBody: tooDeep })).status, 400);
  });

  await t.test('production refuses weak secrets and implicit mock security integrations', () => {
    const cwd = path.join(__dirname, '..');
    const common = {
      ...process.env,
      NODE_ENV: 'production',
      PHI_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      STORE_DRIVER: 'kv',
      UPSTASH_REDIS_REST_URL: 'https://example.invalid',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
      APP_URL: 'https://app.example.invalid',
    };
    const weak = spawnSync(process.execPath, ['-e', "require('./src/app')"], {
      cwd, encoding: 'utf8', env: { ...common, JWT_SECRET: 'change-me-to-a-long-random-string', ALLOW_MOCK_IN_PRODUCTION: 'true' },
    });
    assert.notEqual(weak.status, 0);
    assert.match(weak.stderr, /JWT_SECRET/);

    const mock = spawnSync(process.execPath, ['-e', "require('./src/app')"], {
      cwd, encoding: 'utf8', env: { ...common, JWT_SECRET: 'strong-production-secret-0123456789abcdef', INTEGRATION_MODE: 'mock', ALLOW_MOCK_IN_PRODUCTION: 'false' },
    });
    assert.notEqual(mock.status, 0);
    assert.match(mock.stderr, /Production cannot use mock/);
  });

  await t.test('authentication attempts are rate limited', async () => {
    await store.reset();
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await request('/auth/egov/exchange', { method: 'POST', body: { exchangeCode: `demo-${i}` } })).status);
    }
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
    assert.equal(statuses[10], 429);
  });
});
