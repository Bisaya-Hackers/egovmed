# Contributing

Small repo, small rules. The goal is that six months from now `git log` reads like a changelog
and the branch list is short enough to scan.

## Branch naming

```
<type>/<short-kebab-description>
```

Use the same `<type>` set as commit messages, so a branch name and its eventual commit agree:

| Type | Use for |
|---|---|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Housekeeping, deps, config, cleanup |
| `ci` | CI, workflows, repo automation |
| `refactor` | Restructuring with no behavior change |
| `test` | Tests only |

Good:

```
feat/everify-web-sdk
fix/liveness-session-replay
docs/readme-showcase
ci/trufflehog-base-head
chore/prune-merged-branches
```

Avoid:

```
randomizer-pr                                     no type, says nothing
bugfix/feature/message-reply/replace-coming-soon  four segments, two types
NEW EDIT Fix: ...                                 not a branch name, and not a PR title either
```

Keep it to **two segments**. If you need a third to explain it, pick the type that best fits the
bulk of the session's work.

One branch, one session. Everything done in a single working session — even several logically
separate fixes or features — goes into one branch and one PR, rather than being split across
several. Name the branch and write the PR title/body for the session's main thrust; call out the
individual pieces in the PR body.

## Workflow

```bash
git checkout main && git pull
git checkout -b fix/liveness-session-replay
# work, commit
git push -u origin HEAD
gh pr create --base main
```

CI must be green before merge. The required checks are backend tests plus audit, frontend build
plus audit, TruffleHog secret scan, and CodeQL. Reviews are not required, but force-pushing to
`main` is blocked.

Merge with **squash only**. Merge commits and rebase merges are disabled at the repo level, so
history on `main` stays one commit per PR.

**Branches delete themselves on merge.** `delete_branch_on_merge` is on. You do not need to
clean up after yourself, and you should not have to run a branch-pruning session again.

## Commit and PR titles

Conventional-commit shape, since the squash commit takes the PR title verbatim:

```
<type>(<scope>): <imperative summary>
```

```
feat(backend): eMessage live — real SMS push
fix(http): defense-in-depth guard against SSRF
docs: rewrite README as a project overview
```

The squash commit message is the **PR body**, so write the body as the commit message you want
on `main`. Say what changed and why, not just what. If a decision was non-obvious, record the
reasoning there. That body is where a future reader will look first.

## Cleaning up stragglers

If branches accumulate anyway, note that **`git branch --merged` does not work here.** Squash
merging writes a new commit onto `main`, so the original branch commits are never ancestors of
it and every merged branch looks unmerged. Going by that signal you would either keep everything
or force-delete blind.

Use PR state instead:

```bash
# remote branches whose PR is merged
gh pr list --state merged --limit 100 --json headRefName --jq '.[].headRefName' |
  while read b; do git ls-remote --exit-code --heads origin "$b" >/dev/null 2>&1 && echo "$b"; done
```

Before deleting, confirm nothing was pushed after the merge. Compare the branch tip against the
PR's `mergedAt` **in epoch seconds** — branch tips carry a local offset and merge times are UTC,
so comparing the ISO strings directly gives wrong answers.

```bash
git push origin --delete <branch>
git fetch --prune
```

Never delete a branch with an open PR. GitHub auto-closes the PR when the branch goes.

## Before you open a PR

- `cd backend && npm test` passes. All 30 must stay green; regressions block merge.
- No secrets in the diff. `.env` is gitignored, keep it that way.
- If you touched an integration adapter, check it still behaves in **both** `mock` and `live`
  modes. Mock has to keep working, since it is what makes the demo survive a sandbox outage.
- If you touched any invariant below, say so explicitly in the PR body and explain why.

## Load-bearing invariants

These are not style preferences. Each one is the reason some specific attack or data-loss
scenario does not work. Changing one is fine if it is deliberate, but it should never happen as
a side effect of another change. Reasoning is recorded in
[docs/security-review-mock-to-live.md](docs/security-review-mock-to-live.md).

- **`store.claimStatus` Lua CAS** (`backend/src/store/kvStore.js`). Makes liveness sessions single-use.
  A passing concurrency test asserts that two simultaneous replays resolve to exactly one 200 and
  one 400. Do not replace it with a read-then-write.
- **The `sanitize()` emergency floor** (`backend/src/integrations/egovAi.js`). The rule-based classifier
  can raise triage urgency but never lower it, so a degraded or prompt-injected model response
  cannot downgrade an emergency. It must stay in force in live mode.
- **Hash-only anchoring** (`backend/src/integrations/egovChain.js`). `anchorLive` strips payloads to
  `{type, anchoredAt}`. No patient ID, title, facility, or clinical content ever goes on-chain
  (Data Privacy Act 2012).
- **The outbound HTTP guard** (`backend/src/lib/http.js`). HTTPS-only, HTTP on loopback only, enforced at
  the transport rather than per call site so a refactor cannot silently reintroduce SSRF.
- **Dual-version record decryption** (`backend/src/lib/crypto.js`). Records carry `encryptedVersion`, and
  v1 records must stay readable. There is no key migration path yet, so a change here can orphan
  data permanently.
- **`patientIdFor` derivation** (`backend/src/services/authService.js`). Keeps SSO login idempotent per
  `egovSub`. Changing it forks existing patients into new records.
- **The security middleware stack** (`backend/src/middleware/index.js`). `secureHeaders`,
  `jsonComplexity`, `rateLimit`, the timing-safe admin compare, and JWT verification.
- **All 30 backend tests stay green at every commit.** Regressions block merge in CI.
