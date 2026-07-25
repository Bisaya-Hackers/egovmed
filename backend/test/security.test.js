'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret-0123456789abcdef0123456789abcdef';
process.env.PHI_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.STORE_DRIVER = 'memory';
process.env.INTEGRATION_MODE = 'mock';
process.env.APP_URL = 'http://localhost:3000';
process.env.ADMIN_KEY = 'test-only-admin-key-0123456789abcdef0123456789abcdef';

// Sentinel credential values — the /integrations/status leak test asserts these
// are NOT present in the response body under any input. Previously the test
// grepped for credential FIELD NAMES ("secret", "apiKey"), which the handler
// never emits by construction, so the assertion was unfalsifiable. Now we grep
// for the actual values, which would appear if any field were accidentally
// serialized. Includes a URL with embedded userinfo/api-key to regression-cover
// the rpcUrl-carries-credentials finding.
const CREDENTIAL_SENTINELS = {
  EGOVPH_PARTNER_CODE: 'SENTINEL-egovph-partner-code',
  EGOVPH_PARTNER_SECRET: 'SENTINEL-egovph-partner-secret',
  EGOV_AI_ACCESS_CODE: 'SENTINEL-egov-ai-access-code',
  EVERIFY_CLIENT_ID: 'SENTINEL-everify-client-id',
  EVERIFY_CLIENT_SECRET: 'SENTINEL-everify-client-secret',
  EVERIFY_PUBKEY: 'SENTINEL-everify-pubkey',
  FACE_LIVENESS_API_KEY: 'SENTINEL-face-liveness-api-key',
  EMESSAGE_AUTH_TOKEN: 'SENTINEL-emessage-auth-token',
  EGOVCHAIN_CONTRACT_ADDRESS: 'SENTINEL-egovchain-contract',
  // Deliberately-invalid hex so warnIfMisconfigured's live-mode format check would
  // catch it if the mode were flipped — but INTEGRATION_MODE=mock here, so it doesn't.
  EGOVCHAIN_PRIVATE_KEY: 'SENTINEL-egovchain-private-key',
  // URL carries userinfo and an api-key path segment — safeOrigin() in the status
  // route must strip both. If the whole string leaks, s3cret_pw or api_key_ABC will
  // appear in the response body and the sentinel assertion below will fail.
  EGOVCHAIN_RPC_URL: 'https://user:s3cret_pw@rpc.example.invalid/v3/api_key_ABC',
  EGOVPAY_TOKEN: 'SENTINEL-egovpay-token',
  EGOVPAY_SETTLEMENT_TEMPLATE_UUID: 'SENTINEL-egovpay-settlement-uuid',
  EREPORT_ACCESS_CODE: 'SENTINEL-ereport-access-code',
  EREPORT_VIEW_TOKEN: 'SENTINEL-ereport-view-token',
};
Object.assign(process.env, CREDENTIAL_SENTINELS);

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

    const ownerMessages = await json(await request('/messages', { token: owner }));
    assert.equal(ownerMessages.response.status, 200);
    assert.equal(ownerMessages.response.headers.get('ratelimit-limit'), '60');
    assert.equal(ownerMessages.value.length, 1);
    assert.equal(ownerMessages.value[0].kind, 'confirmation');
    assert.equal(ownerMessages.value[0].patientId, undefined);
    assert.equal(ownerMessages.value[0].to, undefined);
    assert.equal(ownerMessages.value[0].body, undefined);

    const attackerMessages = await json(await request('/messages', { token: attacker }));
    assert.equal(attackerMessages.response.status, 200);
    assert.deepEqual(attackerMessages.value, []);
    const messageAudits = await store.findAll(COLLECTIONS.AUDIT_LOGS, (entry) => entry.action === 'messages.list');
    assert.equal(messageAudits.length, 2);
  });

  await t.test('patient replies write a reply + staff-ack pair, never persist the text, and are tenant-scoped', async () => {
    const ownerId = await resetWithPatients();
    const owner = sign({ sub: ownerId });
    const attacker = sign({ sub: 'pat_attacker' });

    await request('/appointments', { token: owner, method: 'POST', body: { specialty: 'Cardiology' } });
    const initial = await json(await request('/messages', { token: owner }));
    const confirmation = initial.value[0];
    assert.equal(confirmation.kind, 'confirmation');

    // an attacker cannot reply to another patient's message thread
    assert.equal((await request(`/messages/${confirmation.id}/reply`, {
      token: attacker, method: 'POST', body: { text: 'not mine' },
    })).status, 404);

    // an empty body is rejected before anything is written
    assert.equal((await request(`/messages/${confirmation.id}/reply`, {
      token: owner, method: 'POST', body: { text: '' },
    })).status, 400);

    const replied = await json(await request(`/messages/${confirmation.id}/reply`, {
      token: owner, method: 'POST', body: { text: 'When should I arrive?' },
    }));
    assert.equal(replied.response.status, 201);
    assert.equal(replied.value.reply.kind, 'reply_sent');
    assert.equal(replied.value.reply.meta.inReplyTo, confirmation.id);
    assert.equal(replied.value.ack.kind, 'staff_ack');
    assert.equal(replied.value.ack.meta.inReplyTo, confirmation.id);
    // the reply text itself must never come back in the response or be persisted
    assert.equal(JSON.stringify(replied.value).includes('When should I arrive'), false);

    const stored = await store.findAll(COLLECTIONS.MESSAGES);
    const storedReply = stored.find((m) => m.id === replied.value.reply.id);
    assert.equal(storedReply.text, undefined);
    assert.equal(storedReply.body, undefined);

    const thread = await json(await request('/messages', { token: owner }));
    assert.equal(thread.value.length, 3); // confirmation + reply_sent + staff_ack

    // replying to a nonexistent message id is a 404, not a 500
    assert.equal((await request('/messages/msg_doesnotexist/reply', {
      token: owner, method: 'POST', body: { text: 'hi' },
    })).status, 404);
  });

  await t.test('PATCH /patients/me: contact fields are self-editable, name/DOB are locked', async () => {
    const ownerId = await resetWithPatients();
    const owner = sign({ sub: ownerId });

    // Valid PH E.164 mobile — accepted and persisted.
    const ok = await json(await request('/patients/me', {
      token: owner, method: 'PATCH', body: { phone: '+639175551234' },
    }));
    assert.equal(ok.response.status, 200);
    assert.equal(ok.value.phone, '+639175551234');

    // Non-E.164 phone shapes — rejected with 400. Format canonicalization happens client-side;
    // the API contract is strictly +63 + 10 digits.
    for (const bad of ['09175551234', '639175551234', '5551234', '+1234', 'not-a-phone']) {
      const res = await request('/patients/me', {
        token: owner, method: 'PATCH', body: { phone: bad },
      });
      assert.equal(res.status, 400, `expected 400 for phone=${bad}, got ${res.status}`);
    }

    // Attempts to alter locked identity fields via strict-mode zod are rejected as 400 —
    // firstName/lastName/birthDate/identityVerified come from SSO+eVerify and must not be
    // user-editable via this endpoint.
    for (const bad of [{ firstName: 'Attacker' }, { identityVerified: true }, { birthDate: '2000-01-01' }, { egovSub: 'other-user' }]) {
      const res = await request('/patients/me', { token: owner, method: 'PATCH', body: bad });
      assert.equal(res.status, 400, `expected 400 for body=${JSON.stringify(bad)}, got ${res.status}`);
    }

    // Empty body (no phone AND no email) rejected — no silent no-op PATCH.
    assert.equal((await request('/patients/me', { token: owner, method: 'PATCH', body: {} })).status, 400);

    // Cross-tenant: an attacker's PATCH updates ONLY their own record (JWT sub scoping),
    // never the owner's. Verify the owner's phone from the first PATCH is still intact.
    const attacker = sign({ sub: 'pat_attacker' });
    await request('/patients/me', { token: attacker, method: 'PATCH', body: { phone: '+639170000000' } });
    const ownerAfter = await json(await request('/patients/me', { token: owner }));
    assert.equal(ownerAfter.value.phone, '+639175551234');
  });

  await t.test('PATCH benefits: unknown key does not reflect raw input into the response message', async () => {
    const ownerId = await resetWithPatients();
    const owner = sign({ sub: ownerId });
    // A rejected key must NOT surface the raw URL segment in the error's `message` field —
    // otherwise a caller can steer the message text by crafting the path. The value may
    // appear in `details` (that's typed developer data), but the top-level message must be static.
    const marker = '<img-onerror-alert>';
    const res = await json(await request(`/patients/me/benefits/${encodeURIComponent(marker)}`, {
      token: owner, method: 'PATCH',
    }));
    assert.equal(res.response.status, 400);
    assert.equal(res.value.error.message, 'Unsupported benefit');
    assert.equal(res.value.error.message.includes(marker), false);
  });

  await t.test('PATCH benefits: rate-limited per user (spam does not overwhelm the store)', async () => {
    const ownerId = await resetWithPatients();
    const owner = sign({ sub: ownerId });
    const statuses = [];
    for (let i = 0; i < 22; i += 1) {
      statuses.push((await request('/patients/me/benefits/philhealth', { token: owner, method: 'PATCH' })).status);
    }
    // First 20 succeed (200), then the limiter kicks in with 429s. No 5xx.
    assert.equal(statuses.filter((s) => s === 200).length, 20);
    assert.ok(statuses.slice(20).every((s) => s === 429), `expected 429s after the 20th request; got ${statuses.slice(20).join(',')}`);
  });

  await t.test('POST /payments rejects a cross-tenant appointmentId (no misattribution)', async () => {
    const ownerId = await resetWithPatients();
    const owner = sign({ sub: ownerId });
    const attacker = sign({ sub: 'pat_attacker' });

    // Owner books an appointment — attacker tries to attach a payment to it.
    const booked = await json(await request('/appointments', {
      token: owner, method: 'POST', body: { specialty: 'Cardiology' },
    }));
    const ownersApptId = booked.value.appointment.id;

    // Cross-tenant attach must be rejected (404 to avoid disclosing appointment existence),
    // and no payment row should be persisted for that attacker.
    const attempt = await request('/payments', {
      token: attacker, method: 'POST',
      body: { billAmount: 300, appointmentId: ownersApptId },
    });
    assert.equal(attempt.status, 404);
    const attackerPayments = await store.findAll(COLLECTIONS.PAYMENTS, (p) => p.patientId === 'pat_attacker');
    assert.equal(attackerPayments.length, 0);

    // Owner's own bill with their own appointmentId still succeeds, with the linkage stored.
    const ok = await json(await request('/payments', {
      token: owner, method: 'POST',
      body: { billAmount: 300, appointmentId: ownersApptId },
    }));
    assert.equal(ok.response.status, 201);
    assert.equal(ok.value.appointmentId, ownersApptId);

    // A completely made-up appointmentId (matches the regex but doesn't exist) is also 404.
    assert.equal((await request('/payments', {
      token: owner, method: 'POST',
      body: { billAmount: 300, appointmentId: 'apt_does_not_exist_anywhere' },
    })).status, 404);
  });

  await t.test('triage symptoms and report narratives are encrypted at rest', async () => {
    const ownerId = await resetWithPatients();
    const owner = sign({ sub: ownerId });
    const triage = await json(await request('/triage', {
      token: owner, method: 'POST', body: { text: 'I have a mild headache', language: 'en' },
    }));
    assert.equal(triage.response.status, 201);
    assert.equal(triage.value.inputSymptoms, 'I have a mild headache');
    assert.equal(triage.value.specialty, 'Neurology');
    assert.equal(triage.value.urgency, 'routine');
    assert.match(triage.value.reasoning, /headache|nervous system/i);
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

  await t.test('/integrations/status is admin-gated and leaks no credential values', async () => {
    await resetWithPatients();
    // Missing admin key → 403 (never 200)
    assert.equal((await request('/integrations/status')).status, 403);
    // Wrong admin key → 403
    assert.equal((await request('/integrations/status', { headers: { 'x-admin-key': 'nope' } })).status, 403);
    // Correct admin key → 200 with structured payload
    const ok = await json(await request('/integrations/status', { headers: { 'x-admin-key': process.env.ADMIN_KEY } }));
    assert.equal(ok.response.status, 200);
    assert.equal(typeof ok.value.globalMode, 'string');
    for (const integ of Object.values(ok.value.integrations)) {
      assert.equal(typeof integ.mode, 'string');
      assert.equal(typeof integ.hasCredentials, 'boolean');
    }
    const raw = JSON.stringify(ok.value);
    // The real assertion: NONE of the sentinel credential values must appear in the response.
    // Because the sentinels are set as the actual env values (see top of file), a handler that
    // serialized any credential-carrying field would emit its sentinel and fail this check.
    for (const [name, value] of Object.entries(CREDENTIAL_SENTINELS)) {
      assert.equal(raw.includes(value), false, `${name} sentinel leaked into /integrations/status response`);
    }
    // Regression cover for the "rpcUrl embeds credentials" finding — even the parsed pieces
    // (userinfo + api-key path segment) must not survive safeOrigin() stripping.
    assert.equal(raw.includes('s3cret_pw'), false, 'rpcUrl userinfo password leaked');
    assert.equal(raw.includes('api_key_ABC'), false, 'rpcUrl path api key leaked');
    assert.equal(raw.includes('user:s3cret_pw'), false, 'rpcUrl userinfo pair leaked');
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
