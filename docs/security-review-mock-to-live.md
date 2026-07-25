# Security Review — mock→live prep changes
**Repo:** `Bisaya-Hackers/egovmed` · **Branch:** `claude/egov-mock-to-live-0d492f` · **Scope:** the diff from `origin/main` on this branch only

The full attack surface has already been pentested (see [`docs/pentest-handoff.md`](pentest-handoff.md)). This review is **narrower on purpose**: it covers only the code that landed on this branch as scaffolding for the mock→live rollout. Do not re-audit the whole app — the previous pentest is the baseline.

Goal: prove the changes below don't (a) weaken any invariant the previous pentest confirmed, (b) leak credentials via the new observability surface, (c) enable someone to write anchors the backend would trust, or (d) silently degrade a production safety check.

If you find a Critical or High bug, stop and file it before continuing.

---

## Files to review

Read the diff between `origin/main` and `HEAD` — that is the entire scope. The changed files, and what specifically to look for in each:

### `backend/src/routes/integrations.routes.js` (new)
Admin-gated `GET /integrations/status`. Returns `mode`, `hasCredentials`, `baseUrl` per integration.

- Confirm `requireAdmin` is the second-to-last middleware and precedes the handler (compare to `reports.routes.js` pattern).
- The `hasCredentials` predicates are booleans — verify no branch returns a raw secret. Trace every `env.<x>.<y>` access in the file: none should serialize a secret. `baseUrl` and `contractAddress` are considered non-secret; `partnerCode` is the account identifier (equivalent to a username), not a secret. All of those are safe to expose to an admin.
- Rate limit is `admin` scope, `10 / 15min` — matches the existing admin routes. Confirm the same shared bucket is desired (a burst of `/status` calls could throttle `/reports/escalate-stale` and vice versa).
- **Threat model**: assume an attacker holds a valid patient JWT but not the admin key. The route must 403 with no body variance that reveals whether an integration is live. Try passing wrong-length keys, wrong-encoding keys, and a valid key with mixed casing — the compare is via `crypto.timingSafeEqual` in `middleware/index.js` (`sameSecret`) so casing matters. Verify no timing side-channel gives away key length.
- **Regression check**: the new test in `backend/test/security.test.js` greps the response body for credential-shaped substrings (`secret`, `private_key`, `apiKey`, etc.). Confirm the grep list is exhaustive against every field name in the response payload. Add any you spot.

### `backend/src/config/env.js` (modified — extended fail-hard list)
The list of required-live-in-prod integrations grew from 4 to 8.

- Confirm the guard is still inside `if (env.isProd && !env.allowMockInProduction)` — a formatting change that hoisted it out would activate the check in dev.
- Each requirement is `[boolean, name]`. Verify the boolean checks BOTH `mode === 'live'` AND the credential existence — a check that ONLY reads the credential would pass when the mode is still mock (so the credential is present but unused → false green).
- `eReport` requires 6 vars (mode + accessCode + 4 PSA codes). Verify no OR-short-circuit lets any subset satisfy it.
- **Failure mode to test**: spawn the app with `NODE_ENV=production ALLOW_MOCK_IN_PRODUCTION=false` and one integration missing its credential — must fail hard with a message that names the specific integration. Existing test at `security.test.js:213` covers the shape; add a case that verifies the extended list catches each of the four new entries individually.

### `backend/src/integrations/egovChain.js` (rewritten)
- `verifyAnchor` no longer trusts `eth_getTransactionReceipt`. Confirm the new path (`eth_call → anchoredAt(recordHash)`) cannot be spoofed by an attacker who controls the RPC response — is the `BigInt(ts) > 0n` check safe against a returned object like `{gt: () => true}` or a hex string that parses to `0x...deadbeef`? Ethers returns a `BigInt`, but if the RPC is compromised, does the deserializer accept anything that duck-types? Read `ethers.Contract`'s return handling; add a test with a stubbed provider that returns a garbage-shaped value.
- `recordHash` flows in from `record.anchor.hash` in `recordService.verifyRecord`. That value came from `sha256Hex(...)` at create time, so it should be 64 hex chars. Confirm `contract.anchoredAt(hash)` throws (not silently returns 0) on a malformed hash — because verifyRecord treats 0 as "not anchored", and a swallowed error would render `verified: false` on a legitimate record.
- Fail policy is now explicit: anchor throws (fail-closed), verify returns `verified: false` on RPC failure (fail-safe). Confirm neither policy accidentally inverted.
- The nonce collision comment in the handoff was NOT addressed — this is a known limitation. Note in the finding: two concurrent `POST /records` on the same serverless instance will race the nonce; one will fail with an ethers `nonce too low` error, and the record write will 500. Not a security bug per se, but a reliability one that could mask other issues. Score as informational.
- **Data Privacy Act check**: `anchorLive`'s `safeMeta` is `{type, anchoredAt}` only — confirm nothing else can slip through the `meta` param. Search for every caller of `anchorHash` (grep `anchorHash\(`) and verify the second arg never contains identifiers, patient IDs, titles, facility names, or free text.

### `contracts/RecordAnchor.sol` (new)
Deployed to Besu QBFT (chainId 13371). Zero-fee chain, so gas grief is not a concern, but front-running IS.

- Reentrancy: no external calls, no `transfer`, no `call`. Should be reentrancy-safe. Confirm.
- Access control: `anchor()` is `external` with no `onlyOwner` gate — anyone with the deploy chain's private key can write anchors. That's INTENTIONAL (this is a public registry), but combined with the private-key model in the backend it means anyone who steals `EGOVCHAIN_PRIVATE_KEY` can write anchors the backend will treat as authentic. Score the key handling: is the private key marked Sensitive in Vercel, absent from `.env.example`, never printed by any log line? Grep the codebase for `privateKey` / `PRIVATE_KEY` and audit every reference.
- **Front-running**: if a legitimate `anchor(hash, meta)` transaction is pending in the mempool, can an attacker with any private key on the same chain observe the hash and submit their own `anchor(hash, malicious_meta)` first? YES, and the contract's first-write-wins behavior means the attacker's `submitter` and `metadata` get recorded. The backend's `verifyAnchor` only checks `anchoredAt > 0`, so verify still succeeds — but the "who anchored this" audit trail is spoofable. Score this: severity depends on whether `submitterOf` is ever trusted downstream (currently it isn't, which downgrades to Low).
- **Metadata leakage**: the `metadata` string param is public forever. The backend only sends `{type, anchoredAt}`, but a future refactor that adds a title or note here would publish PHI to the chain irrevocably. Add a comment in `egovChain.js` warning against expanding `safeMeta`.
- **Solidity version**: `^0.8.20` — accepts 0.8.20 through 0.8.999. For a deployed contract, pin exactly (`0.8.20`) so a future recompile can't shift behavior.

### `backend/src/integrations/egovAi.js`, `egovChain.js` (fallback counters)
Added `logger.warn` with `integration:` and `fallback:` fields when live mode silently degrades.

- Confirm the log line never includes the patient's symptom text, patient ID, or any PHI. Only the exception message (from ethers or fetch) and the classification of the fallback reason.
- The `err.message` field can contain the URL, which is fine (base URL is not secret). But if the ethers error includes serialized transaction data (rare, but happens on some RPC errors), it might contain the sender address. That address is public info — safe to log — but worth confirming.

### `backend/package.json` (ethers promoted)
- Verify `ethers` is not `devDependencies` (would break prod builds). Should be in `dependencies`.
- Verify `package-lock.json` is regenerated and the `optional: true` flag was dropped from ethers' subtree entries (except `peerDependenciesMeta.optional`, which is a different thing and correct).

### `backend/src/routes/index.js` (mounted new router)
- Trivial. Confirm the mount order doesn't accidentally shadow another route.

### `.gitignore`, `.claude/launch.json` (repo hygiene)
- `.claude/launch.json` was untracked. Confirm the file's actual content (before this change) didn't include any secret. It's a Claude Code dev-server launch config — should just be a command + port.

---

## What NOT to review (already covered by `pentest-handoff.md`)

- Auth/session, IDOR, rate limits on non-admin routes, CORS, PHI encryption at rest, consent replay, store concurrency — all baseline. Don't re-file findings from that scope unless this branch's changes newly break them.
- The 11 existing security regression tests must stay green. Run `cd backend && npm test` — expect 13/13 (11 baseline + 2 new).

---

## Contract review checklist

If Foundry/Hardhat is available, compile `contracts/RecordAnchor.sol` and run `slither` or a similar static analyzer. If not, do a manual pass against SWC (Smart Contract Weakness Classification):

- SWC-101 (integer over/underflow) — Solidity ≥0.8 has built-in checks. N/A.
- SWC-104 (unchecked return) — no low-level calls. N/A.
- SWC-107 (reentrancy) — no external calls. Safe.
- SWC-114 (transaction order dependence / front-running) — YES, discussed above. Score.
- SWC-116 (block-timestamp dependence) — uses `block.timestamp` for the anchor time. That's intentional (an approximate anchoring time is what we want) and manipulable only by ±15 seconds by validators, which doesn't matter for tamper-evidence. Score as informational.
- SWC-131 (unused variables) — the `metadata` param is intentionally silenced with `metadata;`. Note this looks odd but is correct.

---

## Deliverable

Same format as `pentest-handoff.md`:

For each finding: **Title · Severity · File:line · Reproduction · Impact · Suggested fix**.

Group by severity. Report only findings introduced by this branch or newly enabled by it — do not re-file baseline issues.

If there are zero Critical/High findings, say so explicitly. A clean review is a valid result and needed for the mock→live decision.

---

## Exit criteria

- ✅ 13/13 tests green (verify by running `npm test` in `backend/`)
- ✅ No Critical/High findings introduced by this branch, OR the ones you find are filed as GitHub issues before the merge
- ✅ Contract SWC-114 front-running risk explicitly scored (Low if `submitterOf` is not trusted downstream)
- ✅ `EGOVCHAIN_PRIVATE_KEY` handling audited: not in any commit, marked Sensitive in Vercel when set, never logged
- ✅ `/integrations/status` response verified to leak no secret values under any input

## CodeQL suppressions

CodeQL's `security-extended` pack runs on every push and PR. Two suppressions are configured
so noise doesn't drown out real findings — both survive re-review and both are safe:

- **`js/missing-rate-limiting`** — suppressed in [`.github/codeql/codeql-config.yml`](../.github/codeql/codeql-config.yml).
  The rule only recognizes the `express-rate-limit` NPM package. Our custom store-backed
  `rateLimit()` middleware in [`backend/src/middleware/index.js`](../backend/src/middleware/index.js)
  is functionally equivalent but doesn't match the detector's pattern. Manual audit confirmed
  every state-mutating route and every expensive read path (chain writes, eGov AI calls,
  eGovPay calls) has a per-user rate limit. If you migrate to `express-rate-limit`, delete
  the filter and let the rule run.

- **`js/request-forgery` at `backend/src/lib/http.js:26`** — CONFIRMED false positive by
  audit of all 16 outbound call sites. Every URL host component comes from
  `env.<integration>.baseUrl` (never from request input); path segments are static, from
  the owner-scoped store, or `encodeURIComponent`-escaped. Defense-in-depth guard added
  in the same file rejects any non-`https:` outbound URL (except loopback for dev). The
  alert should be dismissed via the Security tab with reason "won't fix — mitigated by
  transport-layer https guard".
