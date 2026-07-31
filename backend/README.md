# eGovMed — Backend

Client-agnostic backend for **eGovMed**: an AI-triage + verified-identity + portable-records + payments layer on top of the eGov API stack. Pilot: **Philippine General Hospital (PGH)**.

Built so a future **kiosk** client can plug into the same API with zero backend changes.

---

## Quickstart

```bash
cp .env.example .env         # then fill in secrets (see below)
npm install
npm run seed                 # optional: load demo patient + a cross-hospital lab
npm run dev                  # http://localhost:4000
```

Everything runs in **mock mode** out of the box — no eGov credentials needed to develop or demo the full flow.

Generate the two required secrets:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # PHI_ENCRYPTION_KEY
```

---

## Integration modes

Each eGov integration runs in `live` or `mock`, set globally by `INTEGRATION_MODE` or per-service by `*_MODE` (e.g. `EGOV_AI_MODE=live` while everything else stays mock).

- **mock** — realistic fake responses; the whole primary flow works offline.
- **live** — calls the real eGov API using your credentials.

---

## Auth: the eGov SSO exchange-code flow

eGov SSO (v2) is **not** OIDC redirect. It's a two-call, partner-credentialed exchange:

1. The eGov super app produces an **`exchange_code`** for the signed-in citizen (sandbox lets you simulate this with your registered eGov account + partner code/secret).
2. Backend → `POST {EGOVPH_BASE_URL}/api/token` with `partner_code`, `partner_secret`, `scope=SSO_AUTHENTICATION`, `exchange_code` → **`access_token`**.
3. Backend → `POST {EGOVPH_BASE_URL}/api/partner/sso_authentication` (Bearer) → the **citizen profile** (`uniqid`, name, birth_date, gender, email, mobile, address, …).
4. Backend upserts the Patient (keyed on `uniqid`) and returns an **eGovMed session JWT** used for every other endpoint.

The frontend sends the exchange code once; after that it uses the session JWT.

**In mock mode the exchange code is the identity.** There is no eGov account behind a mock login, so
the mock profile hashes the exchange code into the `uniqid` — meaning each distinct code resolves to
its own patient, seeded on first use with the demo benefits and its own copies of the three demo
labs, and returns to that same patient on every later login. The frontend generates one random code
per browser and keeps it in `localStorage`, so two people demoing the deployed app at the same time
get two separate records instead of overwriting each other. The bare code `demo` maps to the patient
that `npm run seed` creates. None of this touches the live path.

> **Note:** PhilSys ID is *not* in the SSO profile — it's obtained/confirmed separately via `National ID eVerify` (the `/identity/verify` step).

### Resource APIs (AI, eMessage, eVerify, Pay, Chain, Report)
These currently authenticate with per-service API keys. eGov most likely exposes them through the **same `/api/token` endpoint with a per-service scope** (partner context, no exchange code). `src/integrations/egovToken.js` already implements that cached token minting — once the scope strings are confirmed, each adapter can switch to `getPartnerToken('<SCOPE>')`.

---

## API surface

All routes except `/auth/*`, `/payments/callback`, `/`, and `/health` require `Authorization: Bearer <session-jwt>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/` , `/health` | Service info / health |
| GET | `/auth/config` | Safe public SSO mode/callback metadata (no credentials) |
| POST | `/auth/egov/exchange` | SSO login with an eGov `exchangeCode` → session |
| POST | `/auth/token` | Login with an eGov SSO `accessToken` → session |
| GET | `/patients/me` | Authenticated patient profile (auto-filled from SSO) |
| POST | `/triage` | AI triage: symptoms (Tagalog OK) → `{specialty, urgency, redFlags}` |
| GET | `/triage` | Triage history |
| POST | `/triage/:id/confirm` | Nurse confirmation (triage is decision support) |
| POST | `/identity/liveness` | Create a Face Liveness session |
| POST | `/identity/verify` | PhilSys eVerify (+ consent + liveness) → flips `identityVerified` |
| GET | `/records` | Patient records (identity-gated) |
| POST | `/records` | Add a record (PHI encrypted off-chain, hash anchored on eGovChain) |
| GET | `/records/:id/verify` | Confirm on-chain anchor → "verified from another hospital ✓" |
| GET | `/records/doctor-summary` | AI history summary + verified labs (no repeat labs) |
| POST | `/appointments` | Book → queue number + eMessage confirmation |
| GET | `/appointments` | Appointments list |
| POST | `/appointments/:id/remind` | Send an eMessage reminder |
| PATCH | `/appointments/:id` | Update status |
| POST | `/payments/quote` | Preview benefit auto-apply (PhilHealth/White Card/SSS) |
| POST | `/payments` | Create bill + eGovPay checkout |
| POST | `/payments/callback` | Acknowledge provider notification; never marks paid without server-side status polling |
| GET | `/payments/:id/status` | Refresh payment status |
| POST | `/reports/otp` | Text a single-use 6-digit code to the caller's own number on file |
| POST | `/reports` | File an issue (requires `challengeId` + `code`) → case number |
| GET | `/reports/:caseNumber` | Track a case |
| POST | `/reports/escalate-stale` | Escalation sweep (cron) |
| GET | `/reports/insights/recurring` | Recurring-issue signal for triage feedback |

---

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel (framework preset: **Other**). `vercel.json` routes all traffic to `api/index.js`.
2. **Persistence:** the in-memory store does **not** survive serverless cold starts. Add **Upstash Redis** (Vercel Marketplace → one click), then set `STORE_DRIVER=kv` — `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are injected automatically.
3. Add every variable from `.env.example` under **Settings → Environment Variables** (at minimum `JWT_SECRET`, `PHI_ENCRYPTION_KEY`, and the eGov creds for whichever integrations you set to `live`).
4. Set `APP_URL` to your frontend origin (CORS).
5. For live on-chain anchoring only: run `npm i ethers` (optional dependency).

---

## Project structure

```
api/index.js            Vercel serverless entry (exports the Express app)
src/
  app.js  server.js     app factory + local dev server
  config/env.js         env loading/validation + per-integration modes
  lib/                  logger, errors, http client, crypto (PHI), jwt
  middleware/           auth guard, zod validation, error handler
  store/                memory + Upstash KV repositories, demo seed
  integrations/         one adapter per eGov API (live + mock)
  services/             business logic (kept HTTP-agnostic for the kiosk client)
  routes/               thin Express controllers
```

See `ROADMAP.md` for the phased build plan.
