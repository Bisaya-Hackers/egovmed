# eGovMed — handoff for live-flow bug fixes

**Repo:** `Bisaya-Hackers/egovmed` · **Branch:** `main` · **Commit at handoff:** `4279f30` · **Deployed staging:** `https://egovmed-frontend.vercel.app` + `https://egovmed-backend.vercel.app`

You're picking up an eGovMed hackathon project (Node/Express backend + React/Vite frontend, deployed on Vercel). Three integrations are **flipped to `live` in production**: eGovPay, Face Liveness, eGov AI. The rest (SSO, eMessage, eVerify, eReport, eGovChain) are still `mock` with `ALLOW_MOCK_IN_PRODUCTION=true` on the backend.

There are three regressions to fix. Skim the "What NOT to break" list before you start, verify each fix against the deployed URLs, and don't re-litigate architecture decisions the earlier session made — everything else is in a good place.

## Local setup

```bash
git clone https://github.com/Bisaya-Hackers/egovmed.git
cd egovmed
# backend
cd backend && cp .env.example .env    # user has a populated .env at ~/Desktop/egov/backend/.env
npm install
npm run dev                             # http://localhost:4000 (mock mode by default)
# frontend, in another shell:
cd frontend && npm install && npm run dev   # http://localhost:3000 → proxies /api → :4000
# tests:
cd backend && npm test                  # security regression suite (11 tests)
```

Vercel CLI is installed and logged in as `starrayx`. `vercel --prod --yes --force` from `backend/` or `frontend/` deploys.

## The three bugs

### 1. 🔴 Payment status stuck on "pending" after successful eGovPay checkout

**Symptom:** user goes through the pay flow → lands on `egovpay-pgi-dev.oueg.info/<uuid>` → sandbox shows *"Transaction Success! PAID"* → user is redirected back to `https://egovmed-frontend.vercel.app/payment/return?...` → **app displays `Payment status: pending`** and the "Pay now · ₱300" button is still active (never flips to the settled state).

**One weird data point:** the sandbox receipt shows **₱120.00** for one test whereas the app sent `billAmount: 750` → PhilHealth 60% → **balance ₱300** and Pay-now shows ₱300. So the sandbox amount doesn't match what we sent. Look at whether the settlement template deducts a fee, or `amount` vs `items[].amount` mismatch, or the sandbox is showing a leftover from a prior test.

**Where to look:**
- `frontend/src/App.jsx` — search for `/payment/return` handler in the mount effect (~line 118). It reads `egovmed.pendingBillId` from `sessionStorage`, calls `finishPayment(billId)`, and sets `paid` based on whether `payment.status` is in `['paid', 'settled', 'success', 'successful', 'completed']`.
- `finishPayment` calls `api.paymentStatus(billId)` which hits `GET /payments/:id/status` on the backend.
- Backend `paymentService.refreshStatus` → `egovPay.getStatus(reference)` → `GET {baseUrl}/api/v1/transaction/:reference` → reads `data.status` and `data.paid_at`.
- Hypotheses:
  - eGovPay's status polling response uses a different field name (like `state` or `payment_status` instead of `status`)
  - The status value is a string other than the whitelisted ones (e.g. `SUCCESS` uppercase; whitelist is lowercase)
  - `sessionStorage.egovmed.pendingBillId` isn't being set at pay-start (check `App.jsx` `doPay` and the Payment screen "Pay now" handler)
  - The `redirect_url` doesn't preserve the bill_id (needs a query param OR sessionStorage carries it — check what Codex did)

**Quick reproduction curl:**
```bash
BASE=https://egovmed-backend.vercel.app
TOKEN=$(curl -sS -X POST $BASE/auth/egov/exchange -H 'content-type: application/json' \
  -d '{"exchangeCode":"demo"}' | jq -r .token)
BILL=$(curl -sS -X POST $BASE/payments -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"billAmount":1000,"channel":"GC"}' \
  | tee /dev/stderr | jq -r .id)
# Manually complete the checkout in a browser at the returned checkoutUrl,
# then poll:
curl -sS "$BASE/payments/$BILL/status" -H "Authorization: Bearer $TOKEN"
```
Compare the raw eGovPay response by hitting their sandbox directly with `X-eGovPay-Token`; direct hit that already worked is in `docs/pentest-handoff.md` history — you'll need to peek at `backend/src/integrations/egovPay.js` line ~55 (`getStatus`) and log the raw `res` to see the actual field names.

### 2. 🟠 Records detail sheet renders **inline** in the scroll area, not as a modal overlay

**Symptom:** tap a lab card on the Records screen → the sheet's content ("Wbc 7.5", "Platelets 250", "Interpretation…", "Content hash") appears at the top of the scroll region while the rest of the record list continues to scroll below it. Should be a bottom sheet with a scrim covering the whole viewport.

**Where to look:**
- `frontend/src/screens/Records.jsx` — the `RecordSheet` component renders `<div className="scrim">` + `<div className="sheet">`. In `src/styles/index.css`, `.scrim` is `position: absolute; inset: 0; z-index: 40;`. The `.device` container has `position: relative` so `absolute` positions to it.
- Recent CSS changes (commit `62e87e2`) made `.scroll` and `.screen-wrap` into `display: flex; flex-direction: column`. That likely broke the `.scrim`'s ability to overlay because the sheet is being rendered inside `.screen-wrap` (a flex column child), so `absolute inset: 0` inside a flex layout can behave oddly relative to the nearest positioned ancestor.
- The `RecordSheet` is currently returned as a sibling of the list inside `<div className="screen">`. If `.screen`'s ancestor stacking context is limited to the scroll region, the scrim won't cover the viewport.

**Likely fixes:**
- Portal the sheet to `document.body` (or to `.device`) so it's a sibling of `.scroll`, not a child.
- OR make `.scrim` `position: fixed; inset: 0` with a `z-index` high enough to be above `.bottomnav`.
- OR move sheet-rendering up to `App.jsx` level (like `DemoSheet`/`TimeoutModal` in `Overlays.jsx`) so it sits outside `.scroll`. See how `DemoSheet` works — it's rendered by `App.jsx` after the bottom nav, and its scrim covers everything correctly.

The pattern to copy is `frontend/src/components/Overlays.jsx` `DemoSheet`.

### 3. 🔴 Sign-in stuck on "Checking eGovPH…"

**Symptom:** load the app fresh → SignIn screen shows a spinner + "Checking eGovPH…" and never advances to MPIN. Sign-in stays disabled.

**Where to look:**
- `frontend/src/App.jsx` mount effect (~line 75, the `resumeStarted` gate). It calls `api.authConfig()` which hits `GET /auth/config` on the backend. The initial state has `authMode: 'loading'`; the effect is supposed to set it to `'mock'` or `'live'` based on the config response.
- The SignIn screen shows "Checking eGovPH…" whenever `authMode === 'loading'`. If `authConfig()` throws (network error, CORS, 500, etc.), the catch block sets `signinErr: true` but might not clear `authMode`.
- Test: `curl https://egovmed-backend.vercel.app/auth/config` — should return `{"mode":"mock","callbackUrl":"...","launchUrl":null}`. If it returns 500 or rate-limits (429), the frontend is stuck.
- Look at the browser Network tab: is `/api/auth/config` failing? Is it a rate-limit? Recent flip of integrations to live may have burned through the eGovAI token endpoint's rate; if authConfig somehow got included in that, it could be rate-limited.
- Also possible: the `/api/auth/config` route triggered the global 300/min rate limit because the frontend calls it on every mount and the user was iterating. Check `backend/src/middleware/index.js` `rateLimit` — the global scope is `'api'` at 300/min. Very unlikely to hit that solo, but worth ruling out.

**Fastest fix path:** in the mount effect's catch block, always set `authMode: 'mock'` as a fallback so the user can proceed. Currently the catch may leave `authMode: 'loading'`.

## Architecture reminders

- **Backend** at `backend/` — Express app served as a Vercel serverless function. `api/index.js` is the entry. All API routes under `src/routes/`. Store is Upstash Redis (`STORE_DRIVER=kv`) with the `kvStore` adapter (`src/store/kvStore.js`). Middleware: `requireAuth`, `requireAdmin`, `rateLimit`, `validate` (zod), `jsonComplexity`, `secureHeaders`. Codex's security tests in `backend/test/security.test.js` all pass.
- **Frontend** at `frontend/` — Vite + React. State machine in `App.jsx` (no react-router; URL query params are read on mount for provider redirects). Screens in `src/screens/`. Assets in `src/assets/`.
- **Integrations** — all under `backend/src/integrations/`, one file per API. Each has a mock/live toggle. Currently `live`: eGovPay, Face Liveness, eGov AI. Rest are `mock` with `ALLOW_MOCK_IN_PRODUCTION=true` gate.
- **Docs:** `apidocumentation/*.md` has the real eGov API specs (SSO, eVerify, Face Liveness, eGovAI, eMessage, eGovChain, eGovPay, eReport). Read these when you're unsure of a request/response shape.
- **Session token** persisted to `sessionStorage` under `egovmed.session` (see `frontend/src/lib/api.js`). Same-tab redirects (SSO, liveness, payment) rely on `sessionStorage` for `egovmed.livenessSessionId` and `egovmed.pendingBillId` — check they're being SET at the flow-start.

## What NOT to break

The earlier session did a security pass + backend hardening + real-integration wiring. Don't touch:
- The security middleware stack (`secureHeaders`, `jsonComplexity`, `rateLimit`, timing-safe admin compare, JWT verify).
- The store abstraction (`kvStore.claimStatus` Lua CAS is what makes liveness anti-replay work).
- `env.js` `warnIfMisconfigured` — the prod fail-hard checks that refuse to start on weak secrets/missing KV/wildcard CORS.
- The `patientIdFor` derivation in `authService` — makes SSO login idempotent per `egovSub`.
- Records v2 encryption (`encryptedVersion: 2`) — encrypts title/type/sourceFacility/summary as well as data. The `present()` decryptor handles both v1 (legacy) and v2 (current).
- `ALLOW_MOCK_IN_PRODUCTION=true` is a **deliberate temporary flag** while other integrations stay mock. When all citizen-facing integrations are `live`, flip it to `false` per `docs/deploy-staging.md` §7.
- The seed logic — it's self-healing and idempotent; don't rewrite it to be one-shot.

## What "done" looks like

Fix all three bugs and verify by:
1. **Payment:** run the flow end-to-end on the live URLs, land on eGovPay sandbox, complete payment, return to app, see the settled state (green checkmark, "Payment settled", receipt line).
2. **Records sheet:** tap a lab, see a bottom sheet that fully covers the viewport with the scrim above the bottom nav. Escape/scrim-click/close-button all dismiss.
3. **Sign-in:** on a fresh session, sign-in loads within 2 seconds and shows the MPIN + fingerprint UI. If the backend is unreachable, the app degrades to mock mode within 3 seconds and lets you sign in with any MPIN.

For each fix, commit with a clear message, `vercel --prod --yes --force` from the right directory, and re-verify against the deployed URL.

## Where the user's secrets live

Not in this repo. The user's local `backend/.env` has all the eGov keys, Upstash creds, JWT/PHI/ADMIN secrets. Never printed to chat, never committed. If you need to add/rotate env vars on Vercel, use `vercel env add <NAME> production` and pipe values via stdin (see `docs/deploy-staging.md` for the pattern).

Vercel envs are marked SENSITIVE so `vercel env pull` shows `"[SENSITIVE]"` for values — that's expected, runtime still reads real values.

## Commit style

- StarRayX <40836712+StarRayX@users.noreply.github.com> as author.
- No `Co-Authored-By: Claude` trailer (user preference).
- Feel free to attribute Codex or others as coauthors if their work is directly included.

Good luck.
