# Deploy staging on Vercel

Two Vercel projects out of one repo (`Bisaya-Hackers/egovmed`): **backend** at `backend/` and **frontend** at `frontend/`. Backend needs Upstash Redis (mem store is refused in prod). Total time: **~30 min**.

## 0 · Before you start

Have handy:
- Your `backend/.env` file (all the eGov API keys — never commit this).
- The Vercel account that will own the projects (personal or a `Bisaya-Hackers` team).

## 1 · Log in to Vercel (interactive, one-time)

```bash
vercel login
```
Pick GitHub. This step needs a browser; I can't do it for you.

## 2 · Deploy the backend

Skeleton commands — details below.

```bash
cd C:\Users\starx\Desktop\egov\backend
vercel link           # → New project · egovmed-backend · (your scope)
vercel env pull       # optional: fetch what's already there
# add every env var (see mapping below), then:
vercel --prod
```

**Add Upstash Redis before setting envs:** Vercel dashboard → your project → **Storage** → **Marketplace** → **Upstash for Redis** → *Create Database (free tier)*. Vercel auto-injects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

### Backend env vars

Set every row **for `Production` environment**. Values come straight from your local `backend/.env`.

**Core (required):**
```
NODE_ENV=production
PORT=4000                    # Vercel ignores this but env.js still reads it
STORE_DRIVER=kv
APP_URL=<paste after frontend deploy>   ← e.g. https://egovmed.vercel.app
API_PUBLIC_URL=<self URL>               ← e.g. https://egovmed-api.vercel.app
JWT_SECRET=<your 64-hex from .env>
PHI_ENCRYPTION_KEY=<your 64-hex from .env>
ADMIN_KEY=<generate 32+ char string>
INTEGRATION_MODE=mock                    ← start mock, flip per-service once verified
```

**Per-integration (all from your `.env`):**
| Vercel var | Your `.env` |
|---|---|
| `EGOVPH_BASE_URL` | `https://hackathon-sso.e.gov.ph` |
| `EGOVPH_PARTNER_CODE` | your partner-code |
| `EGOVPH_PARTNER_SECRET` | your partner-secret |
| `EGOVPH_LAUNCH_URL` | optional |
| `EGOV_AI_BASE_URL` | `https://egov-ai-core-ws.oueg.info` |
| `EGOV_AI_ACCESS_CODE` | your access-code |
| `EVERIFY_BASE_URL` | `https://hackathon-everify-api.e.gov.ph` |
| `EVERIFY_CLIENT_ID` | your client-id |
| `EVERIFY_CLIENT_SECRET` | your client-secret |
| `EVERIFY_PUBKEY` | your pubkey |
| `FACE_LIVENESS_BASE_URL` | `https://hackathon-face-liveness-api.e.gov.ph` |
| `FACE_LIVENESS_API_KEY` | your api-key |
| `FACE_LIVENESS_CALLBACK_URL` | `<backend URL>/liveness/callback` |
| `EMESSAGE_BASE_URL` | `https://ws-message.e.gov.ph` |
| `EMESSAGE_AUTH_TOKEN` | your access-token |
| `EGOVCHAIN_MODE` | `mock` (leave until you deploy your contract) |
| `EGOVCHAIN_RPC_URL` | `https://hackathon-blockchain.e.gov.ph` |
| `EGOVCHAIN_CHAIN_ID` | `13371` |
| `EGOVPAY_BASE_URL` | `https://egovpay-pgi-ws-dev.oueg.info` |
| `EGOVPAY_TOKEN` | your `test_…` api-key |
| `EGOVPAY_SETTLEMENT_TEMPLATE_UUID` | your uuid |
| `EGOVPAY_REDIRECT_URL` | `<frontend URL>/payment/return` |
| `EGOVPAY_CALLBACK_URL` | `<backend URL>/payments/callback` |
| `EREPORT_BASE_URL` | `https://stg-ereport-ws.oueg.info` |
| `EREPORT_ACCESS_CODE` | your access-token |
| `EREPORT_TYPE` | `red_tape` (no health type exists — see `docs/ereport-integration.md`) |
| `EREPORT_REGION_CODE` | `130000000` (NCR) |
| `EREPORT_PROVINCE_CODE` | `133900000` (CITY OF MANILA) |
| `EREPORT_MUNICIPALITY_CODE` | `133908000` (ERMITA — Manila districts are "municipalities" here) |
| `EREPORT_BARANGAY_CODE` | `133908012` (Barangay 670, best available match for PGH) |

**Fastest way to bulk-add:** Vercel dashboard → project → **Settings → Environment Variables → Import .env** — paste the whole file.

## 3 · Deploy the frontend

```bash
cd C:\Users\starx\Desktop\egov\frontend
vercel link           # → New project · egovmed-frontend · (your scope)
# set one env var (see below), then:
vercel --prod
```

### Frontend env vars

```
VITE_API_BASE_URL=<backend URL>/         ← e.g. https://egovmed-api.vercel.app
```

## 4 · Wire the URLs back together

After both deploys, you'll have two URLs. Go back and fill them in:
1. **Backend project** → set `APP_URL` to the frontend URL, `API_PUBLIC_URL` to itself, and finalize the redirect/callback URLs above. Redeploy backend.
2. **Frontend project** → set `VITE_API_BASE_URL` to the backend URL. Redeploy frontend.

## 5 · Register the callback URLs with the providers

For each **live** integration, tell the provider the callback URL is now HTTPS + stable:
- **eGovPH SSO** — hand `<frontend URL>/egovph/sso` to the eGov admin as your redirect URL (they whitelist it against `EGOVPH_PARTNER_CODE`).
- **Face Liveness** — the `callback_url` in the create-session body is `<backend URL>/liveness/callback` (already in env).
- **eGovPay** — `redirect_url` = `<frontend URL>/payment/return`; `callback_url` = `<backend URL>/payments/callback` (already in env).

## 6 · Go live per-service

**Never flip everything at once.** Start with the smallest live surface, verify, then next:
1. `EGOVPAY_MODE=live` → check `/health` → run the full flow to Payment → confirm you land on the hosted checkout → back-to-app.
2. `FACE_LIVENESS_MODE=live` → verify a liveness capture and confirm `getLivenessResult` returns `SUCCEEDED`.
3. `EVERIFY_MODE=live` → confirm a real PhilSys match (needs a real ID for testing).
4. `EGOVPH_MODE=live` → last, because it changes the whole entry flow.
5. `EMESSAGE_MODE=live`, `EGOV_AI_MODE=live`, `EREPORT_MODE=live` — safe to flip in any order.
6. `EGOVCHAIN_MODE=live` — deploy anchoring contract first (see backend README §eGovChain).

## 7 · Final tripwire — flip `ALLOW_MOCK_IN_PRODUCTION` off

**MUST DO once every citizen-facing integration is `live` above.** While `ALLOW_MOCK_IN_PRODUCTION=true`, the `warnIfMisconfigured` fail-hard for missed live flips is bypassed — so a silent mock could serve fake triage/payment/records data to real users.

```bash
cd backend
vercel env rm ALLOW_MOCK_IN_PRODUCTION production --yes
printf 'false' | vercel env add ALLOW_MOCK_IN_PRODUCTION production
vercel --prod --yes --force
curl -sS https://egovmed-api.vercel.app/health   # must return {"status":"ok"}
```

If `/health` returns 500 after this, the log will name the integration still in mock — flip it to `live` and redeploy.

---

## Deployment security posture (as of first go-live)

### Currently in place
- **Preview scope hardened**: eGov integration secrets (partner-code/secret, client-id/secret, pubkey, API keys, tokens, contract private key) removed from Preview environment scope. Also, `JWT_SECRET` and `PHI_ENCRYPTION_KEY` were rotated at deploy time and only added back to Production scope — meaning **preview deployments intentionally cannot boot**. This is safe because no git-connected auto-deploy is enabled; deployments happen manually via `vercel --prod`.
- **Sensitive typed env vars**: All secrets marked Sensitive in Vercel — CLI `env pull` returns `"[SENSITIVE]"` placeholders, only runtime + dashboard-with-explicit-reveal can see values.
- **HTTPS everywhere**: Vercel edge terminates TLS, redirect/callback URLs verified HTTPS at boot.
- **CORS locked** to `APP_URL` (the exact production frontend origin) with credentials. Preview frontend URLs cannot hit prod backend.
- **Rate limiting active** (Upstash-backed, cross-instance): global 300/min + tighter per-route auth/callback limits.
- **Security headers on every response** (CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy).

### Enabling preview deploys later (if wanted)
Preview deploys currently fail-fast at boot. To enable them safely:
1. Generate distinct **test** JWT/PHI secrets (different from prod).
2. Add them + Upstash + fresh test versions of the eGov `*_MODE=mock` overrides scoped to `preview` only.
3. Add a preview-only `ALLOW_MOCK_IN_PRODUCTION=true` so warnings don't fire.
Never share prod secrets or the prod Upstash DB with preview deployments.

### Known deferred items (post-hackathon)
- **`PHI_ENCRYPTION_KEY` has no key versioning.** `crypto.js` resolves exactly one key; a future rotation with real PHI in Upstash would permanently orphan the data. Fix later: extend the `v1:` envelope to `v2:<keyId>:iv:tag:ct` with a keyring, or migrate/re-encrypt during rotation.
- **No PHI-access audit log rotation/retention policy** (Codex's `auditService` writes to Upstash; grows forever without an eviction/export policy).
- **Vercel Hobby single region** — backend is pinned to `sin1`. If Vercel-sin1 goes down, the app goes down. Multi-region requires Pro.

Between each flip, redeploy backend and hit `/health` + one real request through the impacted flow.

## Troubleshooting

- **"Production cannot use mock…"** on deploy → an integration required in prod (SSO, eVerify, Face Liveness, eGovPay) is still mock or missing creds. Either flip that mode to `live` or set `ALLOW_MOCK_IN_PRODUCTION=true` for a demo build.
- **"STORE_DRIVER=kv but Upstash credentials are missing"** → the Upstash integration wasn't linked to this project. Add it via Storage → Marketplace, then redeploy.
- **CORS error in browser** → `APP_URL` on the backend doesn't exactly match the frontend origin (protocol + host + no trailing slash).
- **429 on provider redirect back** → the per-IP rate limiter is hitting a shared egress; loosen `payment-callback` scope or move to per-session key.
