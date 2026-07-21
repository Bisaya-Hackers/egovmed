# eGovMed — Implementation Roadmap

Status legend: ✅ built · 🔜 your turn (needs credentials/decisions)

## Phase 0 — Foundations ✅
Repo, env config with per-integration `live`/`mock` switches, storage layer (in-memory + Upstash KV), session-JWT auth, error handling, request validation, health checks, demo seed.

## Phase 1 — Identity: the anchor ✅
eGov SSO exchange-code login (`/api/token` → `/api/partner/sso_authentication`) with profile auto-fill, plus a direct access-token path. PhilSys **eVerify** with consent + **Face Liveness** gating access to records. `identityVerified` flips only after a successful check.

## Phase 2 — AI triage: the live demo centerpiece ✅
eGov AI symptom classification with Tagalog/Taglish support → `{specialty, urgency, redFlags, summaryEn, recommendedAction}`. Always emits an urgency flag; emergencies route to Emergency Medicine. Nurse-confirm step (decision support, not diagnosis). Deterministic rule-based fallback so the demo never breaks offline.

## Phase 3 — Records & trust ✅
HealthRecord CRUD. PHI encrypted **off-chain** (AES-256-GCM); only the SHA-256 fingerprint is **anchored on eGovChain** (Besu JSON-RPC). Anchor verification drives the "Lab result verified from another hospital ✓" badge. AI-summarized doctor view surfaces verified labs → **no repeat labs**.

## Phase 4 — Appointments & messaging ✅
Booking with per-specialty queue number; eMessage confirmations and reminders to the verified contact (SMS/email/in-app); status transitions.

## Phase 5 — Payments ✅
Benefit auto-apply (White Card → PhilHealth → SSS) with a transparent, swappable rules engine; eGovPay checkout for the remaining balance; status refresh.

## Phase 6 — Reports & feedback loop ✅
eReport issue filing with case numbers; time-based auto-escalation sweep; recurring-error mining as a feedback signal to improve triage.

## Phase 7 — Hardening & deploy 🔜
Plug in real credentials, flip chosen integrations to `live`, wire Upstash KV, deploy to Vercel, connect the frontend. Recommended adds: rate limiting, per-request audit log for PHI access, and a scheduled function for `reports/escalate-stale`.

## Confirm with the eGov admin 🔜
- **Auth decision:** SSO Authentication for citizen login (required) + partner access tokens for resource APIs. See README.
- **Scope strings** for each resource API (to switch adapters to the unified `/api/token` + `getPartnerToken(scope)` pattern), or confirm they use standalone API keys.
- Exact request/response shapes for eVerify, eMessage, eGovPay, eReport (adapters have `NOTE:` markers where shapes are assumed).
- eGovChain anchoring **contract address + ABI** and a funded signer key.

## Future (do NOT build now)
Lobby **kiosk** client for walk-in patients (in-session enrollment, assisted mode). Backend is already client-agnostic — the kiosk is a second client over the same API, no backend changes.
