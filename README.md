# eGovMed

**The smart front door to public healthcare.** A web app that runs AI symptom triage, verified
identity, portable medical records, and payments on top of the Philippine government's eGov API
stack. Pilot target: Philippine General Hospital (PGH).

> One login, one medical record, one payment. Patients stop re-entering data, stop repeating
> labs, and stop lining up to pay.

**Live:** [egovmed-frontend.vercel.app](https://egovmed-frontend.vercel.app) ·
[backend](https://egovmed-backend.vercel.app/health)
**Team:** Bisaya-Hackers (UP Manila) · **Event:** eGov Hackathon
**Stack:** React 18 + Vite · Node/Express · Upstash Redis · Hyperledger Besu · Vercel

---

## The flow

1. **Sign in** with an eGovPH account. The patient profile auto-fills from SSO.
2. **Describe symptoms** in English, Tagalog, or Taglish. Triage returns a specialty, an urgency
   level, and red flags.
3. **Verify identity** with consent: a face liveness capture plus a PhilSys demographic match.
4. **Book** an appointment and get a queue number, with an SMS confirmation.
5. **Pay** through the unified government gateway, with statutory discounts applied.
6. **Records** are encrypted at rest, and their hashes are anchored on-chain so tampering is
   detectable.

## The 8 eGov APIs

| API | Role |
|---|---|
| **eGovPH SSO** | Login to session, auto-fill the patient profile |
| **eGov AI** | Symptom triage and translation to `{specialty, urgency, red_flags}` |
| **National ID eVerify** | Match against PhilSys with consent, gate record access |
| **Face Liveness** | Confirm a live person during ID capture (anti-abuse) |
| **eMessage** | Confirmations and reminders over SMS |
| **eGovChain** | Anchor record hashes on Besu for tamper evidence |
| **eGovPay** | Settle bills through the unified gateway |
| **eReport** | File and track complaints by case number, escalate stale ones |

---

## Integration status

Every integration runs in one of two modes, `mock` or `live`, selected per service by an
environment variable. This is deliberate: the demo stays functional when a government endpoint
is down, and no integration goes live until its credentials and response shape are verified
against the real API.

| Integration | Prod mode | Notes |
|---|---|---|
| Face Liveness | **live** | Real capture through the hosted eGov UI |
| eGovPay | **live** | Real hosted checkout, credentials verified |
| eGov AI | **live** | Upstream returning 503, falls back to the rule-based classifier |
| eGovPH SSO | mock | Awaiting callback-URL whitelisting from the eGov admin |
| eVerify | mock | Blocked on the eVerify Face Liveness Web SDK (see below) |
| eMessage | mock | Upstream account suspended |
| eReport | mock | Upstream returning 503 |
| eGovChain | mock | Contract not yet deployed, Besu RPC returning 502 |

Most of the remaining blockers are upstream availability on the hackathon sandbox, not
application work. The rollout plan lives in [docs/deploy-staging.md](docs/deploy-staging.md).

**Known integration gotcha.** The two portal API docs contradict each other on where
`face_liveness_session_id` comes from: the Face Liveness doc says to reuse its hosted session
token, the eVerify doc says to use the eVerify Web SDK. We settled it by testing rather than
reading. Querying eVerify with a real completed hosted session, and again with a randomly
generated UUID as a control, produced byte-identical `face_liveness_error_exception` responses.
The hosted token is not interchangeable. Without the control query the first result would have
been unreadable, since a rejection could equally have meant a bad demographic match.

The SDK path is built and off by default. Turning it on needs three things: `EVERIFY_PUBKEY` on
the backend (already set — `GET /auth/config` now serves it to the browser, which is where the
SDK puts it anyway), `VITE_EVERIFY_SDK_ENABLED=true` on the frontend, and `EVERIFY_MODE=live`
plus the eVerify client credentials on the backend. The frontend's `Permissions-Policy` also has
to delegate the camera to `https://liveness.everify.gov.ph`, because the SDK captures inside a
cross-origin iframe rather than on our own origin.

---

## Security engineering

The threat model assumes real patient health information, so most of the engineering effort
went here rather than into features.

**Protecting health data**
- PHI is encrypted at rest with a versioned envelope. The decryptor reads both v1 and v2 records
  so a format change never orphans existing data.
- On-chain anchoring is hash-only. `anchorLive` strips payloads down to `{type, anchoredAt}`
  before submission, so no patient ID, facility, or clinical content ever reaches the chain
  (Data Privacy Act 2012).
- Identity verification writes an auditable consent receipt. The eVerify response carries heavy
  PII that is deliberately never persisted beyond the fields the service already stores.
- Message bodies are never written to the audit log, with a regression test asserting it.

**Preventing abuse**
- Liveness sessions are single-use, patient-bound, and expire in 10 minutes. The claim is a
  Redis Lua compare-and-set, so two simultaneous replays resolve to exactly one success and one
  rejection. A concurrency test asserts this.
- Rate limiting is Upstash-backed and therefore shared across serverless instances, with a
  global ceiling plus tighter per-route budgets on auth and callback endpoints.
- Admin routes compare keys in constant time.
- Payment callbacks are treated as non-authoritative. A forged callback returns 202 and writes
  nothing.

**Hardening the perimeter**
- Outbound HTTP enforces HTTPS-only, with HTTP allowed on loopback alone. The check lives at the
  transport, so a future refactor cannot reintroduce SSRF by forgetting it at one call site.
- Strict security headers on every response: CSP, HSTS, `X-Frame-Options: DENY`, nosniff,
  `Referrer-Policy: no-referrer`.
- CORS is pinned to the exact production frontend origin.
- Secrets are Sensitive-typed in Vercel, which makes them unreadable after they are set. Preview
  deployments intentionally cannot boot, so no preview build can reach production data.

**Failure behavior is chosen, not accidental**
- Anchor writes **fail closed**. An unverifiable record is never stored.
- Anchor verification **fails safe**. An RPC error yields `verified: false` rather than a green
  badge.
- Notifications are **best effort**. A failed SMS never fails a booking, but it is logged.
- The AI triage classifier has a rule-based floor that can only raise urgency, never lower it.
  It stays in force in live mode, so a degraded or hostile model response cannot downgrade an
  emergency.
- With `ALLOW_MOCK_IN_PRODUCTION` off, the app **refuses to boot** if any integration is still
  mocked or missing credentials, naming the offender. A silent mock cannot serve fake triage or
  payment data to a real patient.

**Verification**
- 30 backend security regression tests, required to pass before merge.
- CI runs backend tests, dependency audits on both packages, CodeQL `security-extended`, and a
  TruffleHog secret scan.
- Branch protection on `main` with those checks required and force-push blocked.

Full audit trail: [docs/security-review-mock-to-live.md](docs/security-review-mock-to-live.md)
and [docs/pentest-handoff.md](docs/pentest-handoff.md).

---

## Architecture

```
frontend/          React 18 + Vite, deployed to Vercel
backend/
  src/routes/      Express routers, validation and rate limits at the edge of each route
  src/services/    Business logic, storage, and consent and audit writes
  src/integrations/  One adapter per eGov API, each with a mock and a live path
  src/store/       Pluggable driver, Upstash Redis in prod and in-memory for tests
  src/lib/         Crypto, HTTP client with the SSRF guard, logging
  test/            Security regression suite
contracts/         RecordAnchor.sol, Solidity 0.8.20
```

The backend is client-agnostic on purpose. An assisted kiosk client for walk-in patients with no
phone is on the roadmap and plugs in as a second client without backend changes.

Every integration adapter carries a mock path, so the whole product runs offline with no
credentials. That is what makes the demo resilient to sandbox outages.

---

## Getting started

```bash
git clone git@github.com:Bisaya-Hackers/egovmed.git
cd egovmed/backend
cp .env.example .env
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api` to the backend.

**Generate real local secrets before first run.** `JWT_SECRET` and `PHI_ENCRYPTION_KEY` must be
real values, because the crypto layer silently falls back to an ephemeral random key in
development. Records written before a restart become undecryptable after it.

```bash
openssl rand -hex 32   # run three times: JWT_SECRET, PHI_ENCRYPTION_KEY, ADMIN_KEY
```

Run the tests with:

```bash
cd backend && npm test
```

### Testing from a phone on the same Wi-Fi

Open `http://<PC-LAN-IP>:3000`. Vite listens on all local interfaces. If Windows marks the
network as Public, allow the port once from an Administrator PowerShell:

```powershell
New-NetFirewallRule -DisplayName 'eGovMed local phone testing' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -RemoteAddress LocalSubnet -Profile Public,Private
```

Remove it when you are finished:

```powershell
Remove-NetFirewallRule -DisplayName 'eGovMed local phone testing'
```

Same-Wi-Fi HTTP is enough for the app and the mock adapters, but not for eGovPH SSO, hosted Face
Liveness, or eGovPay. Those require a public HTTPS origin.

---

## Build rules

1. **`.env` holds all secrets and is gitignored.** Copy `.env.example` to `.env`.
2. **Triage is decision support, not diagnosis.** Output always carries an urgency level and red
   flags, and a human confirms. Urgent patterns produce a clear instruction to seek immediate
   medical assessment.
3. **eGovChain stores only hashes, pointers, consent, and timestamps.** Raw PHI stays encrypted
   off-chain.
4. **Benefits (PhilHealth, white card, SSS) are labeled mocks.** Do not claim those APIs exist.
   The same applies to hospital systems and national medical repositories.
5. **National ID eVerify is the authoritative identity API.** No passport verification claims.
6. **Identity is the anchor.** Records, appointments, and payments all key off the eGov PhilSys
   identity.
7. **Never set the global mode to `live`** while any integration is incomplete. Flip one service
   at a time and verify before moving on.

---

## Docs

| Doc | What it covers |
|---|---|
| [docs/deploy-staging.md](docs/deploy-staging.md) | Vercel deployment and the per-service go-live order |
| [docs/security-review-mock-to-live.md](docs/security-review-mock-to-live.md) | Security audit and the reasoning behind each decision |
| [docs/pentest-handoff.md](docs/pentest-handoff.md) | Penetration testing notes |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Build plan |
| [docs/design-handoff.md](docs/design-handoff.md) | UI and design specs |
| [contracts/README.md](contracts/README.md) | Contract deployment and the on-chain audit trail |

## Roadmap

- Assisted kiosk client for walk-in patients with no phone or low digital literacy.
- Per-field provenance tracking so manual profile edits survive an SSO refresh.
- Key versioning for `PHI_ENCRYPTION_KEY`. Rotation currently has no migration path.
- Retention and rotation policy for the PHI access audit log.
