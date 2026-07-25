# eGovMed — handoff: flip each eGov integration from mock to live

**Repo:** `Bisaya-Hackers/egovmed` (public) · **Branch:** `main` · **Latest commit at handoff:**
`0f6ca22` · **Deployed prod:** `https://egovmed-frontend.vercel.app` +
`https://egovmed-backend.vercel.app`

**Working copy:** `C:\Users\StarX\Desktop\SCHOOL\career-building\egovmed` — origin points at
`Bisaya-Hackers/egovmed`, `main` tracks `origin/main`, `backend/.env` is populated locally,
`backend/.vercel` and `frontend/.vercel` are linked (`egovmed-backend` / `egovmed-frontend`,
scope `starrayxs-projects`). This is the only checkout — work here.

**What's done vs. what you're inheriting.** All prep is merged to `main`. Nothing open, no
pending housekeeping. The prep includes: admin-gated `/integrations/status`, `RecordAnchor.sol`
+ `verifyAnchor` via real `eth_call`, extended `warnIfMisconfigured` covering all 8
integrations, adapter response shapes aligned with portal docs (eVerify `data.code ===
'AAA000'`, eReport `Bearer` header + `PFM-` case regex, eMessage E.164), CI (backend tests +
audit, frontend build + audit, trufflehog secret scan, CodeQL security-extended), branch
protection on main (CI required, reviews not required, force-push blocked), `PATCH
/patients/me` + Account edit UI so patients can add/fix their phone before the eMessage flip,
SSRF defense-in-depth guard on the outbound HTTP client, and 12-benefit expansion in the
eGovPay benefit engine (PWD/Senior/Solo Parent match statutory PH discounts).

**Zero of the five live flips have happened.** Do not re-litigate the prep — it's captured on
merged PRs #2, #3, #7, #8, #9, #10, #11 and in `docs/security-review-mock-to-live.md`.

Read `docs/deploy-staging.md` §6–7 before you start. Do not re-litigate architecture decisions.

---

## The 5 flips, in order of cheapest-to-hardest

Every integration is `mock` in prod right now (verify with
`curl -H "x-admin-key: $ADMIN_KEY" https://egovmed-backend.vercel.app/integrations/status`).
`ALLOW_MOCK_IN_PRODUCTION=true` is still on — the fail-hard list in `warnIfMisconfigured`
covers all 8 integrations, so removing that flag *after* the flips locks in the guarantee.

### Task 1 · eMessage (start here — smallest surface, proves the deploy loop)

Credentials, base URL, mode variable are all present in Vercel prod. The one thing to confirm
before flipping is that the **eMessage `sender_id`** value (`eGovMed`) is registered with the
eGov admin — unregistered senders drop silently. If it is, the flip is:

1. In the portal (https://platforms.e.gov.ph, log in), open eMessage → Test tab. Send one SMS
   to your own phone using the current `EMESSAGE_ACCESS_TOKEN` value. If it arrives,
   credentials work.
2. `cd backend && vercel env rm EMESSAGE_MODE production --yes` then
   `printf 'live' | vercel env add EMESSAGE_MODE production --sensitive --yes` (all Vercel env
   commands use `--yes --sensitive` for non-interactive).
3. `cd backend && vercel deploy --prod --yes`.
4. Sign in to prod, book one appointment. Real SMS should arrive. If it doesn't, `/health`
   will still be OK — check backend Vercel logs for the `logger.warn` counter we added in
   `eMessage.send`.

Commit: `feat(backend): eMessage live — real SMS push`.

### Task 2 · eGovChain (longest lead time — start in parallel with Task 1)

Contract source is ready at `contracts/RecordAnchor.sol` (Solidity 0.8.20, matches the ABI
`egovChain.js` calls). Deploy guide at `contracts/README.md`. Neither `EGOVCHAIN_PRIVATE_KEY`
nor `EGOVCHAIN_CONTRACT_ADDRESS` are set in Vercel prod.

1. Generate a signer keypair (`node -e "const w=require('ethers').Wallet.createRandom(); console.log(w.address, w.privateKey)"`).
2. Import that private key into MetaMask; add the Besu network (RPC
   `https://hackathon-blockchain.e.gov.ph`, chainId `13371`, gasPrice 0).
3. Open the contract in remix.ethereum.org, compile with 0.8.20, deploy via MetaMask.
4. Copy the deployed address + tx hash into `contracts/README.md`'s deployment table (that
   file is intentionally checked in as the audit trail — don't delete the section).
5. Add both secrets to Vercel prod as Sensitive:
   `printf '0x…' | vercel env add EGOVCHAIN_CONTRACT_ADDRESS production --sensitive --yes`,
   same for `EGOVCHAIN_PRIVATE_KEY`.
6. Set `EGOVCHAIN_MODE=live`, redeploy.
7. Verify: `POST /records` from prod → response has `anchor.txHash`; check on
   `https://hackathon-explorer.e.gov.ph`; hit `GET /records/:id/verify` → `verified: true`.
   Then hand-edit the encrypted payload in Upstash → same endpoint should flip to
   `verified: false`. That second half is the actual tamper-evidence proof.

**Fail policy** (documented inline in `egovChain.js`): `anchorHash` throws on live failure
(fail-closed — never store an un-verifiable record). `verifyAnchor` returns `verified: false`
on RPC error (fail-safe — never grant a green badge on a bad RPC).

**Optional smoke test before real deploy**: the hackathon chain has a shared demo
`HackathonGuestbook` contract at `0x2012eFf5594bA45eC8Ec537B982dd18dc529CA95`. Submit one
`createTeam` write with your fresh keypair to prove RPC + signer + zero-fee submission all
work before deploying `RecordAnchor`.

Commit: `feat(chain): eGovChain live — real on-chain anchoring + tamper-evidence`.

### Task 3 · eReport

Blocked when we last checked — the staging endpoint at `stg-ereport-ws.oueg.info` was
returning HTTP 503 `"Integration API is not currently available"` on token mint (verified via
portal Test tab + direct fetch). Root URL responded normally, so the app itself is up; only
`/api/integration/token` was refusing. Ask eGov admin: **"Is the eReport integration
activated for our partner account? We're getting 503 'Integration API is not currently
available' from the token endpoint. Root URL responds normally."**

Once unblocked:
1. Hit `GET /api/integration/datasets/report_types` in the portal to pick the right
   `EREPORT_TYPE` enum value for health-facility complaints. `red_tape` is a placeholder;
   `crime` from the docs example is wrong for health. Something like `health_service`.
2. PSA codes for PGH (Ermita, Manila, NCR) are already set in Vercel — verify they resolve
   to real values (they came back `""` when pulled locally because Sensitive; check the
   dashboard).
3. Set `EREPORT_MODE=live`, redeploy, file one test complaint from prod → real case number
   should come back in `PFM-MMDDYY-####` format.

**View-token model design decision**: `report_view_token` is per-complainant AND time-limited
(has `expires_at`). The env-wide `EREPORT_VIEW_TOKEN` in config cannot look up arbitrary
patients' cases. Recommended for MVP: drop the tracking screen's "Under review" fake status
— just show the case number and tell the patient to check on eReport directly. Requires
small `Report.jsx` edit + backend `getStatus` simplification.

Commit: `feat(backend): eReport live — real complaint filing with PGH location codes`.

### Task 4 · eVerify (the big one — needs frontend rewrite)

Portal docs are unambiguous: **"face_liveness_session_id is secured via the eVerify Face
Liveness Web SDK: call `window.eKYC().start({ pubKey })` and pass the returned
`result.session_id` as face_liveness_session_id."** Our current `Liveness.jsx` uses the
hosted `/v1/liveness/session` redirect flow, which mints a session id from a different
service. The two are NOT interchangeable.

Do NOT flip `EVERIFY_MODE=live` until Liveness.jsx is rewritten. If you do, every real
identity verify will fail because eVerify's `/api/query` rejects sessions minted by the
hosted service.

Plan:
1. Frontend: replace the hosted redirect in `Liveness.jsx` with the eVerify Web SDK. `pubKey`
   comes from `EVERIFY_PUBKEY` (already set in Vercel; surface it via `/auth/config` — add a
   new field, extend the security-test assertion to cover it).
2. Backend: `identityService.verifyIdentity` already takes `livenessSessionId` from the
   request body; no shape change needed. The `store.claimStatus` single-use CAS guarantee is
   what protects against session replay — do not remove or weaken it (there's a passing
   concurrency test that asserts two simultaneous replays resolve to exactly one 200 + one
   400).
3. Decide: keep the hosted Face Liveness step somewhere else in the flow, or drop it
   entirely. Running both back to back is a bad patient experience. Document either way.
4. Test with your real PhilSys ID. Confirm a deliberate mismatch (wrong birthdate) fails
   closed.

Confirmed response shape from portal (already applied to `identity.verifyPhilSys`):
`{ data: { code, reference, ... } }`. Success = `data.code === 'AAA000'`. NO `score` field.
Reference field is `reference` (not `reference_id`). Response also carries heavy PII
(full_name, gender, marital_status, blood_type, mobile_number, full_address) — never surface
beyond what `identityService` already stores.

Commit: `feat(frontend): eVerify Face Liveness Web SDK integration + eVerify live`.

### Task 5 · eGovPH SSO (last — it changes the entry flow)

Need eGov admin to whitelist the callback URL `https://egovmed-frontend.vercel.app/egovph/sso`
against your `EGOVPH_PARTNER_CODE`. They'll issue an `EGOVPH_LAUNCH_URL` in return.

1. Send request to eGov admin (their contact channel).
2. When you receive the launch URL, add it to Vercel:
   `printf 'https://…' | vercel env add EGOVPH_LAUNCH_URL production --sensitive --yes`.
3. Set `EGOVPH_MODE=live`, redeploy.
4. `curl https://egovmed-backend.vercel.app/auth/config` must return the launch URL and
   `mode: "live"`.
5. Sign in with your real eGovPH account from prod. Land on Home with your real profile
   auto-filled. The exchange code is single-use — refreshing the SSO return page must NOT
   re-submit (`App.jsx` `cleanUrl()` handles this; verify it still does).

Commit: `feat(backend): eGovPH SSO live — real exchange-code flow`.

---

## Task 6 · Close the escape hatch (only after all 5 above are live)

Verify:
```bash
curl -H "x-admin-key: $ADMIN_KEY" https://egovmed-backend.vercel.app/integrations/status
```

Every integration should show `mode: "live"` and `hasCredentials: true`.

Then:
```bash
cd backend
vercel env rm ALLOW_MOCK_IN_PRODUCTION production --yes
printf 'false' | vercel env add ALLOW_MOCK_IN_PRODUCTION production --sensitive --yes
vercel deploy --prod --yes --force
curl https://egovmed-backend.vercel.app/health   # must return {"status":"ok"}
```

If `/health` 500s, the log names the exact integration still misconfigured — the fail-hard
list in `warnIfMisconfigured` covers all 8.

Commit: `chore(backend): remove ALLOW_MOCK_IN_PRODUCTION — mock path physically unavailable`.

---

## Things that will trip you up

**Vercel is NOT git-connected.** Merging to main does not deploy. You must
`cd backend && vercel deploy --prod --yes` and `cd frontend && vercel deploy --prod --yes`
manually after any merge. The prior session considered enabling Git integration and left it
unresolved — do NOT be surprised when a merge doesn't show up on the live URLs until you
deploy.

**Vercel env vars are Sensitive.** `vercel env pull --environment=production` returns `""`
for everything — you cannot read the current values via CLI. Use the dashboard when you need
to see what's actually set.

**Auto-mode classifier may block `vercel deploy --prod`** unless bypass is enabled. If you
hit that, the classifier is doing its job — the user runs the deploy themselves. Don't
fight the block; hand off the two-line command and continue with everything else.

**Vercel CLI `env add` needs `--value <v> --yes` in non-interactive mode**, and for existing
scopes may need `--sensitive` too. Simplest reliable form:
`vercel env add NAME production --value "$V" --sensitive --yes`.

**Branch protection** is set with **required reviews = 0** and `required_conversation_resolution
= false`. CI status checks (secret-scan, backend tests+audit, frontend build+audit, CodeQL)
are the only gates. Squash-merge is the norm; edit the auto-generated commit message down
before merging your own PRs.

**CodeQL suppression** (`.github/codeql/codeql-config.yml`) permanently silences
`js/missing-rate-limiting` because it doesn't recognize our custom `rateLimit()` middleware.
Don't try to "fix" this — the audit that produced this decision is documented in
`docs/security-review-mock-to-live.md` under "CodeQL suppressions". If a real rate-limit
gap appears on a NEW route, add the limit; the suppression only silences the pattern-match
rule.

**Trufflehog `--results=verified` only, empty base/head on push events.** Unverified pattern
matches (URLs in docs, resolved URLs in package-lock, JWT fixtures) are near-guaranteed
false positives on CI. On push events (post-merge to main), passing empty base/head triggers
filesystem scan mode; the diff mode requires a real BASE≠HEAD pair. If you ever need to hunt
down a genuine leak, run `trufflehog git file://.` locally with `--only-verified`.

**Manual phone/email edits get overwritten by SSO on subsequent logins** if SSO returns a
non-empty value for that field. `PATCH /patients/me` was added specifically for the "SSO
omits phone" case (per-field provenance tracking to make manual edits stick even against SSO
would need a follow-up feature — see PR #9 body for the caveat).

---

## What NOT to touch (baseline invariants)

- The security middleware stack: `secureHeaders`, `jsonComplexity`, `rateLimit`, timing-safe
  admin compare, JWT verify.
- `store.claimStatus` Lua CAS (liveness anti-replay, passing concurrency test).
- The `sanitize()` emergency floor in `egovAi.js`. Rule-based classifier must keep overriding
  the model upward. Never let a live-mode change remove the floor.
- Records `encryptedVersion: 2` and the dual-version `present()` decryptor. v1 records must
  stay readable.
- `patientIdFor` derivation in `authService` — keeps SSO login idempotent per `egovSub`.
- Hash-only anchoring. Never put `patientId`, title, facility, or clinical content on-chain.
  `anchorLive` strips metadata down to `{type, anchoredAt}` on purpose (Data Privacy Act
  2012).
- HTTP defense-in-depth guard in `lib/http.js` (https-only + loopback-http). Applies to
  every outbound URL — SSRF audit trail lives in `docs/security-review-mock-to-live.md`.
- All backend tests (currently 18) must stay green at every commit. Tests run in CI's
  Backend job; regressions block merge.

---

## Where the secrets live

Not in this repo. Local `backend/.env` has all eGov keys, Upstash creds, and JWT/PHI/ADMIN
secrets — populated but placeholder-shaped for `JWT_SECRET` and `PHI_ENCRYPTION_KEY` in the
older `.env` version. **Generate real local values** (`openssl rand -hex 32` × 3) before
running the backend, because `crypto.js` degrades to an ephemeral random key silently in
dev, and records written before a restart become undecryptable after it.

Production values are set in Vercel and marked Sensitive. To rotate:
`vercel env rm <NAME> production --yes` then
`printf 'newvalue' | vercel env add <NAME> production --sensitive --yes`.

---

## Commit style

- Author: `StarRayX <40836712+StarRayX@users.noreply.github.com>` (already the git config).
- No `Co-Authored-By: Claude` trailer.
- One commit per integration flip. Squash-merge each PR.
- Message shape: `feat(backend): eMessage live — real SMS push`.
- For contract deployment: separate commit with the deployed address in the message.

---

## What "done" looks like

- All 8 eGov integrations `mode: "live"` per `/integrations/status`.
- `ALLOW_MOCK_IN_PRODUCTION` removed. `/health` returns `{"status":"ok"}`.
- `RecordAnchor.sol` deployed on Besu with address + deploy tx recorded in
  `contracts/README.md`.
- `GET /records/:id/verify` returns `verified: true` for an untampered record and `false`
  after any byte-edit in Upstash.
- One end-to-end run on prod with your real eGovPH account, real PhilSys verify, real SMS
  arriving, real payment, real anchored record.
- Backend tests still 18/18 green.
- Two-sentence note in `docs/` recording every response-shape surprise you actually hit
  during the flips (that knowledge is currently only in commit messages).

Good luck.
