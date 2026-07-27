# Environments

```
local dev  →  staging  →  production
```

| | Branch | Deploys | Integrations | Data |
|---|---|---|---|---|
| **local** | any | `npm run dev` | mock | in-memory or your own Upstash |
| **staging** | `staging` | automatic on push | **all mock** | its own Upstash database |
| **production** | `main` | **manual only** | live where available | production Upstash (real PHI) |

## Why staging is all-mock

Not a limitation. eGov providers whitelist specific callback URLs against our partner code: the
SSO redirect, the Face Liveness callback, and the eGovPay callback. A staging deployment lives on
a different origin, so those round trips cannot complete there no matter how it is configured.

Mock mode exercises every code path except the provider handshake itself, which is what staging
is for. Live integrations get verified in production, one at a time, per
[deploy-staging.md](deploy-staging.md).

## Why production stays manual

`main` never auto-deploys. `vercel.json` sets `git.deploymentEnabled.main = false` on both
projects, so a merge builds nothing. Shipping to production is always:

```bash
cd backend  && vercel deploy --prod --yes
cd frontend && vercel deploy --prod --yes
```

This is deliberate while the eGov rollout is mid-flight. A merge should never be the thing that
puts a half-flipped integration in front of a real patient.

**The tradeoff:** merging does not update production, so production can silently fall behind
`main`. This has already bitten once, with production running four-day-old code while six merged
PRs sat undeployed. After merging anything you intend to ship, deploy it, and confirm with:

```bash
curl -sS https://egovmed-backend.vercel.app/health
curl -sS -H "x-admin-key: $ADMIN_KEY" https://egovmed-backend.vercel.app/integrations/status
```

## Data isolation

Staging **shares production's Upstash database**, separated by a key prefix. This is not the
design anyone would choose. The Upstash account is provisioned through Vercel, which allows one
free database and no way to create another independently, so the choice was a shared database or
no staging at all.

`STORE_KEY_PREFIX` namespaces every Redis key. Production runs with it empty, so production keys
keep their exact original shape and nothing had to be migrated. Staging sets `staging`, producing
`staging:doc:…`, `staging:idx:…`, `staging:ctr:…`, `staging:rl:…`.

**All four namespaces carry the prefix, not just documents.** Prefixing documents alone would
still let staging draw production's next queue number from the shared `ctr:` counter and consume
production's `rl:` rate-limit budget.

Because a misconfiguration here is a silent data disaster rather than a visible error, both
directions **refuse to boot** ([env.js](../backend/src/config/env.js), `warnIfMisconfigured`):

| Condition | Why it is fatal |
|---|---|
| `VERCEL_ENV=production` with a prefix set | Production reads an empty keyspace and looks wiped |
| `VERCEL_ENV=preview` on `kv` with no prefix | Staging writes straight into production's keys |
| Prefix is not a plain slug | A malformed value splits the keyspace unpredictably |

`VERCEL_ENV` is what distinguishes the two, because `NODE_ENV` cannot: staging deliberately runs
`NODE_ENV=production`. A regression test covers all three failures plus both valid configurations.

**The residual risk, stated plainly.** Staging holds credentials that can read and write
production's database. The prefix prevents collisions, not access. A staging compromise, or a bug
that constructs a key without the prefix, reaches real patient data. This is the accepted cost of
a one-database account, and it should be revisited the moment a second database is available:
create it, move staging onto it, and drop `STORE_KEY_PREFIX` back to empty everywhere.

Staging still gets its own `JWT_SECRET`, `PHI_ENCRYPTION_KEY`, and `ADMIN_KEY`. They are throwaway
values with no relationship to the production ones. A staging token must not authenticate against
production, and staging must not be able to decrypt production records even though it can read
their ciphertext.

No eGov credentials belong in Preview scope. Staging runs mock, so it does not need them, and
keeping them out means a staging compromise cannot reach a government API as us.

## Workflow

```bash
git checkout main && git pull
git checkout -b fix/whatever
# work
gh pr create --base main
```

CI runs on the PR. To see it running, push the branch to `staging`:

```bash
git checkout staging && git pull
git merge fix/whatever && git push
```

Staging redeploys automatically. Test there, then merge the PR to `main` and deploy production
manually when ready.

`staging` is a scratch integration branch, not a release train. It may be force-reset to `main`
whenever it drifts:

```bash
git checkout staging && git reset --hard origin/main && git push --force-with-lease
```

Nothing should ever merge **from** `staging` into `main`. PRs always target `main` directly, so
`main` history stays one clean squash commit per change.

## Setup checklist

Requires the Vercel dashboard; the CLI cannot authorize the GitHub App.

1. **Connect Git.** Vercel → `egovmed-backend` → Settings → Git → Connect Git Repository →
   `Bisaya-Hackers/egovmed`. Authorize the Vercel GitHub App on the `Bisaya-Hackers` org and grant
   it access to the repo. Repeat for `egovmed-frontend`.
   - Root Directory must be `backend` and `frontend` respectively.
   - Production Branch: `main`. `deploymentEnabled` already blocks it from building.
2. **Set the Preview env vars** (see below). `STORE_KEY_PREFIX=staging` is mandatory; the
   deployment refuses to boot without it.
3. **Push `staging`** and confirm both deployments come up.

## Preview scope environment variables

Everything below is scoped to **Preview**, never Production.

```
NODE_ENV=production
STORE_DRIVER=kv
STORE_KEY_PREFIX=staging
ALLOW_MOCK_IN_PRODUCTION=true
APP_URL=https://egovmed-frontend-git-staging-starrayxs-projects.vercel.app
API_PUBLIC_URL=https://egovmed-backend-git-staging-starrayxs-projects.vercel.app
JWT_SECRET=<fresh openssl rand -hex 32>
PHI_ENCRYPTION_KEY=<fresh openssl rand -hex 32>
ADMIN_KEY=<fresh openssl rand -hex 32>
INTEGRATION_MODE=mock
EGOVPH_MODE=mock   EVERIFY_MODE=mock   FACE_LIVENESS_MODE=mock   EGOVPAY_MODE=mock
EMESSAGE_MODE=mock EREPORT_MODE=mock   EGOVCHAIN_MODE=mock       EGOV_AI_MODE=mock
```

The Upstash variables are already scoped to Preview and Production together, and staging uses the
same database on purpose, so leave them alone.

`ALLOW_MOCK_IN_PRODUCTION=true` is required in Preview. `NODE_ENV=production` makes
`warnIfMisconfigured` apply its fail-hard list, which would otherwise refuse to boot an all-mock
deployment ([env.js:157](../backend/src/config/env.js)). It must **never** be true in Production
scope; removing it there is the final step of the live rollout.

Frontend Preview scope needs one variable:

```
VITE_API_BASE_URL=https://egovmed-backend-git-staging-starrayxs-projects.vercel.app
```

## Known gap

The branch alias URLs above follow Vercel's standard
`<project>-git-<branch>-<scope>.vercel.app` format, but they cannot be confirmed until the Git
connection exists. If the real aliases differ, update `APP_URL`, `API_PUBLIC_URL`, and
`VITE_API_BASE_URL` to match, or CORS will reject every staging request. CORS is pinned to an
exact origin with no wildcard, which is what makes a stable branch URL necessary rather than
per-PR preview URLs.
