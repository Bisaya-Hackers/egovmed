# State of play — 2026-08-01, 01:00 PHT

Written for whoever picks this up next, human or Claude session. It covers what changed on the
night of Jul 31, what is deployed where, and the traps that have already cost us time. Not
gitignored (unlike `docs/handoff-*.md`), so `git pull` gets you this file.

**Hard deadline: reply to eGovPH by 10:00 AM, Aug 1** with a system URL and credentials for their
technical team's evaluation. The draft reply is in the "Judge access" section below.

## Deployments

| | URL | Deploys from |
| --- | --- | --- |
| Production frontend | https://egovmed.vercel.app | `main`, automatic |
| Production backend | https://egovmed-api.vercel.app | `main`, automatic |
| Staging frontend | https://egovmed-frontend-git-staging-starrayxs-projects.vercel.app | `staging` branch |
| Staging backend | https://egovmed-backend-git-staging-starrayxs-projects.vercel.app | `staging` branch |

`staging` is not a long-lived branch with its own history. It is reset to `main` and force-pushed:

```bash
git checkout staging && git reset --hard origin/main && git push --force-with-lease
```

Both environments share one Upstash Redis database, separated by `STORE_KEY_PREFIX`. Do not
assume a staging write is invisible to production — it is the same database, different key prefix.

## What changed tonight

**eGovChain went from mock to live, and it is real.** `RecordAnchor.sol` is deployed and every
record created in production now writes an actual transaction.

| | |
| --- | --- |
| Contract | `0x77cC3DeF1Cb29ad608316F11d62cE82A0cb9703E` |
| Deploy tx | `0x8f55bb91…` block 381081 |
| Explorer | https://hackathon-explorer.e.gov.ph |

Verified by creating a record through the production API and then asking the chain itself:
`eth_getTransactionReceipt` returned block 382157, status `0x1`, `to` = our contract. Tamper
detection was tested separately by hand-editing the stored ciphertext, which flips `verified:
false` while `anchoredOnChain` stays true. That second half is the actual claim, not the receipt.

**If you ever recompile the contract, you must pin `evmVersion: 'paris'`.** Solidity 0.8.20
defaults to Shanghai and emits `PUSH0`, which this Besu node rejects with a bare
`INVALID_OPERATION` that names no opcode and looks exactly like a permissions refusal. It is not.
Full write-up in `contracts/README.md` — read it before touching the contract.

**PR #64: Records was dead for anyone who signed in through real SSO.** A patient created by real
eGovPH SSO starts `identityVerified: false`, and every route in `records.routes.js` is gated on
`assertVerified`. The seeded demo patient is seeded verified, which is why mock testing never
caught it. The only path to verification was symptom check → triage → consent → liveness → book,
so a real user tapping Records got a raw error with no way out. Records now shows a card offering
to verify, which runs the same consent → liveness flow and returns to Records afterwards.

## Judge access — decided, do not undo without reading this

Production runs `EGOVPH_MODE=mock` **on purpose**. Tapping Sign in logs you straight in with no
credentials. Each device gets its own patient (`mockUniqid` derived per device) and the demo
reset is patient-scoped, so several judges testing at once do not overwrite each other.

Verified against production as a first-time visitor: sign in 200, 3 seeded records, upload 201
with a real on-chain anchor, PhilHealth benefit active.

**Do not flip `EGOVPH_MODE=live` on production.** We were never issued `EGOVPH_LAUNCH_URL`. In
live mode `doSignIn` (`frontend/src/App.jsx:323`) navigates to that URL, and when it is missing it
shows "Open eGovMed from the eGovPH app, or configure EGOVPH_LAUNCH_URL". Flipping it live means
judges tap Sign in and never reach the app.

The launch URL is **not** the same as our callback URL. The callback (`/egovph/sso?exchange_code=`)
is where eGovPH sends a citizen back to us and is already configured from `APP_URL`. The launch
URL is where we send a citizen to *start* login. Setting the former as the latter just reloads our
own page with no code and loops. Eight candidate authorize paths on `hackathon-sso.e.gov.ph` all
404'd; there is nothing to point at.

Real SSO is demonstrated on **staging** instead, where a tester supplies their own code:

1. https://platforms.e.gov.ph/dashboard/api-catalogs/egov-sso
2. Input partner_code `HACKATHON_SSO`
3. Generate, copy the exchange code
4. Open `…-git-staging-….vercel.app/egovph/sso?exchange_code=FRESH_CODE`

Codes are single-use and expire fast. One code, one login. A code generated an hour before it is
clicked will fail with 422, and that failure looks like our bug if the recipient was not warned.

## Integration modes

Verified tonight:

- **Production**: eGovPH SSO `mock`, eGovChain `live`, verification method `face-liveness`
- **Staging**: eGovPH SSO `live`, eGovChain `live`, Face Liveness `live`, eVerify `mock`

Check the rest with `GET /integrations/status` and the `x-admin-key` header. Note the production
admin key is not the `ADMIN_KEY` in `backend/.env` — that one is local-only, and the staging key is
`ADMIN_KEY_STAGING`.

Env vars are scoped per environment in Vercel, and several are split into a `Preview (staging)`
entry and a `Production` entry with different values. **Editing the shared entry changes both.**
When you need them to differ, remove the shared one and add two scoped ones.

## Known problems, in the order they will bite you

1. **Half of the Records verify card is still untested.** The card itself is confirmed rendering
   on staging (screenshot, 01:30) with correct copy and button. What nobody has run is the round
   trip: tap "Verify my identity", complete the face scan, and confirm you land back on **Records
   with labs loaded** rather than in the booking flow. The return target rides in `sessionStorage`
   (`egovmed.verifyReturnTo`) because the hosted capture navigates the tab away and back, so that
   is the fragile part. Two failure shapes to watch for: ending on the booking screen means the
   return target was lost across the reload; landing on Records still locked means the patient was
   not re-fetched after verification.

2. **An expired SSO exchange code shows "Internal server error".** eGovPH returns 422 from
   `POST /api/token` when a code is spent or stale, and `backend/src/lib/http.js` normalizes every
   non-2xx into a 502, so the user is told the app crashed when in fact they just need a fresh
   code. Judges following the SSO instructions will hit this constantly. A PR to map that one 422
   to an actionable 4xx was in flight as of 01:40 — check open PRs before rebuilding it. A real
   eGovPH outage must keep returning 502, or the wrong party goes looking for the bug.
3. **eVerify returns `verified: false` for real demographics.** Staging runs eVerify in mock so
   verification passes there. If anyone flips `EVERIFY_MODE=live`, identity verification becomes a
   hard block and Records locks for everyone. Do not flip it before the demo.
4. **`docs/judging-qna.md` is stale.** It still says eGovChain is mock in production. It is live.
5. **Line endings will bite you on any file, not just dict.js.** The repo has no `.gitattributes`
   and `core.autocrlf=true`. Editing tools here rewrite LF files to CRLF, so a two-line change can
   come back as a full-file rewrite. **Check `git diff --stat` before staging every commit** — if a
   file you barely touched shows hundreds of changed lines, that is why. Convert it back to LF and
   re-stage. The real fix is a `.gitattributes` pinning `* text=auto eol=lf` with an exception for
   dict.js, but that forces a repo-wide renormalization, so it must not be done mid-judging.
6. **`frontend/src/i18n/dict.js` is the worst case.** It is the only file in the repo stored with
   CRLF, and it only avoids normalization because of a stray lone `\r\r\n` on the `caseNo:` line.
   Clean up that stray CR and every one of its 708 lines shows as changed. If you get a whole-file
   diff on dict.js, that is why — restore from `main` and re-apply your keys preserving endings.
7. **Cosmetic:** Consent and Liveness render "step 3 of 4" dots. Entering from Records shows step
   3 with no steps 1 and 2. Left alone deliberately, both screens are on the demo path.

## Reaching production data

There is no route into the live store from a laptop, and this has already been tried. `vercel env
pull` returns every application variable **redacted to an empty string** because they are all
encrypted, and the Upstash credentials in `backend/.env` are blank. There is also no
`DELETE /records/:id` endpoint — records can be created and read but never removed.

This matters less than it sounds. Records are ownership-scoped by `patientId`, and mock SSO gives
every device its own patient, so a stray test record uploaded from one phone is invisible to every
other visitor. Confirmed by signing in fresh and listing records. To clear your own test data,
clear site data for the frontend origin and sign in again — you get a new patient with clean
seeded records. On-chain anchors are immutable and stay regardless, which is rather the point.

## Where the judging email landed

`output/egovmed-judging-email.txt` (untracked) holds the reply to eGovPH: production URL with no
credentials, a five-step path touching every integration, and the staging SSO instructions.

It tells testers to generate a code and open it **in the same browser**, because a code generated
on a PC and opened on a phone failed with 422. Whether that is a short TTL or session binding was
never settled. If a judge reports the SSO link failing, question that first rather than assuming
our exchange is broken — the failure happens before any patient exists on our side.

## Traps that have already cost us hours

- **`vercel deploy --prod` from `backend/` fails.** Root Directory is set to `backend` on the
  project and the CLI doubles it. Use `vercel redeploy <url>`, or push to `main`.
- **`git branch --merged` reports nothing useful.** Everything is squash-merged, so merged
  branches never look merged. Use PR state via `gh` instead, and compare timestamps in epoch
  seconds — ISO string comparison gets it wrong because of `+08:00` versus `Z`.
- **Never `git add -A`.** `docs/judging-qna.*`, `output/` and `scripts/` are intentionally
  untracked working files and get swept in.
- **Check `git status` before committing.** A local `identityVerified: false, // TEMP-MANUAL-TEST`
  edit in `backend/src/store/index.js` nearly shipped tonight. It forces every demo patient
  unverified, which would have locked Records for every judge.
- **`seedDemoData()` runs on every serverless cold start,** not once. It respects
  `manuallyOverriddenFields` so it will not clobber a user's edits, but do not assume it is a
  one-time migration.

## Invariants — do not weaken these

`store.claimStatus` (single-use liveness), the PHI encryption envelope, the triage emergency
floor, hash-only anchoring (no PHI, no identifiers on-chain — Data Privacy Act 2012), and the SSRF
guard in `backend/src/lib/http.js`.

## Before you push

```bash
cd backend && npm test        # 48 passing
cd frontend && npm run build
```

Conventional-commit titles. Open a PR rather than pushing to `main` — `main` auto-deploys to the
URL the judges are testing.
