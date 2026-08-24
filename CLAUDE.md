# Working on eGovMed

Read this before running anything that touches an eGov API.

---

## 🔴 The one that has already burned us: API credits are metered

The eGov developer portal gives each developer **one shared pool of 500 credits across all 8 APIs**.
There is no per-API allowance. When it hits zero, **every** integration returns
`429 quota_exceeded` and the only way back is an administrator top-up.

**We drained a full 500-credit allowance in under five minutes.** It cost us the working demo.

### What burned it

Deploying a contract to eGovChain with a standard Ethereum tooling helper:

```js
// ❌ NEVER DO THIS
await contract.waitForDeployment();   // polls eth_getTransactionReceipt in a loop
await tx.wait();                      // same
```

`waitForDeployment()` and `tx.wait()` poll the JSON-RPC endpoint every few hundred
milliseconds until the transaction is mined. **Every single one of those polls is a billed
gateway call.** Two background runs made 536 requests to `/egovchain` and emptied the account.

### Why it wasn't obvious

eGovChain is reached over plain JSON-RPC at
`https://platforms-api.e.gov.ph/egovchain/{token}`. It looks like ordinary blockchain
infrastructure, and on a normal chain RPC reads are free. **Here they are not.** The token in the
URL is a gateway credential and the gateway meters every request, including `eth_call`,
`eth_blockNumber` and `eth_getTransactionReceipt`.

### The rule

- **Never point a polling helper, retry loop, watcher, or `provider.on(...)` subscription at the
  eGovChain RPC.** Not in a script, not in a test, not in the background.
- To send a transaction: submit it once, then check the receipt **once**, manually, after a delay.
  If it isn't mined yet, check again later by hand. Budget it as a handful of calls, not a loop.
- Anything that runs unattended near this RPC must have a hard call cap.

---

## Before making ANY eGov API call

- **Assume every call costs a credit.** Free ones are the exception, not the rule.
- **Never loop, batch, retry, or load-test any eGov endpoint.** One call, look at the result,
  decide, then maybe one more.
- **Never run an eGov call inside a `for` loop or a background/watch process.**
- Check the balance on the portal dashboard *before* a testing session, not after.

### Known-free calls

Only these are documented as free (they still need a non-zero balance to be allowed through):

- eGov SSO: `/api/token`, `/api/partner/check_access`, `/api/otp_generate`,
  `/api/otp_validate`, `/api/authenticate`

### Known-metered calls

Everything else, including:

- eGov SSO `/api/partner/sso_authentication` — 1 credit per completed profile fetch
- Every eVerify call (`/api/auth` included)
- Every eGov AI generation
- **Every eGovChain JSON-RPC request**

`/api/token` being free while `/api/partner/sso_authentication` costs a credit means a
sign-in loop looks cheap right up until it isn't.

---

## Integration rules that are easy to get wrong

### eVerify only accepts sessions from its own Web SDK

`face_liveness_session_id` **must** come from `window.eKYC().start({ pubKey })` — the eVerify
Face Liveness Web SDK. A session minted by the separate hosted Face Liveness service is rejected
with `face_liveness_error_exception`, even though both are "face liveness".

That is what `VERIFICATION_METHOD` switches:

- `everify` → in-app Web SDK capture, real PhilSys match possible
- `face-liveness` → hosted capture, **no** identity match (eVerify stays mock)

If you see `face_liveness_error_exception`, the session came from the wrong provider. Don't
retry it — retrying just spends more credits on the same rejection.

### The eGovPH login widget cannot be restyled

The "Login as eGov" widget resets its own subtree under `@layer egov-armor` with `!important` on
every declaration. A layered `!important` outranks an unlayered one, so **no host CSS can win** —
not with higher specificity, not with `!important`. This is deliberate; the button is eGovPH's
brand mark.

Your only levers are the render options: `theme`, `size`, `label`, `locale`. Don't waste time
writing overrides — style the *container*, never the widget.

Options the widget actually accepts: `container`, `partnerCode`, `host`, `theme`, `size`,
`label`, `locale`, `partnerName`, `identifierTypes`, `autoClose`, `accessCheck`,
`showTestAccounts`, `onSuccess`, `onError`, `onCancel`, `onOpen`, `onClose`. Anything not in that
list is silently dropped.

### Base URLs: the `hackathon-*` hosts are dead ends

Credentials are issued against the gateway now:

```
https://platforms-api.e.gov.ph/egov-sso
https://platforms-api.e.gov.ph/everify
https://platforms-api.e.gov.ph/egov-ai
https://platforms-api.e.gov.ph/emessage
https://platforms-api.e.gov.ph/egovpay
https://platforms-api.e.gov.ph/ereport
https://platforms-api.e.gov.ph/face-liveness
https://platforms-api.e.gov.ph/egovchain/{token}
```

**One exception:** the Face Liveness *Web SDK script* is still served from
`https://hackathon-everify-face-liveness.e.gov.ph/js/everify-liveness-sdk.min.js`.

### Sandbox accounts — use these, never a real number

No SMS is sent. OTP is always `123456`, PIN always `000000`.

`+639090000001` … `+639090000005`

Each completed sign-in still spends a credit on the profile fetch. Don't sit there logging in
repeatedly to check a CSS change.

---

## Deployment traps

- **Backend will not boot in production without Redis.** `env.js` throws unless
  `STORE_DRIVER=kv` has working Upstash credentials. Vercel's Upstash marketplace integration has
  **no free plan**; a free DB from `console.upstash.com` (region Singapore) is equivalent.
- **`frontend/vercel.json` CSP `connect-src` hardcodes the backend origin.** It is a build-time
  header, not an env var. Change the backend URL and you must edit this file and redeploy, or the
  browser blocks every API call with nothing useful in the network tab.
- **Three URLs must agree:** backend `APP_URL`, frontend `VITE_API_BASE_URL`, and the CSP
  `connect-src`. Any mismatch fails silently as CORS or CSP.
- **Don't add a bare `.env*` line to a `.gitignore`.** Both `.gitignore` files had one *after* the
  `!.env.example` negation, which re-ignored the examples — a fresh clone had no env reference at
  all. The correct trio is `.env`, `.env.*`, `!.env.example`.
- **Setting many env vars via `vercel env add` takes ~4s each.** For a full set use
  `POST /v10/projects/{id}/env?upsert=true`, which accepts an array in one call.

---

## Mock mode is the safety net

`INTEGRATION_MODE=mock` runs the entire app with **zero gateway calls** — mock persona,
rule-based triage, fake payments. Use it for:

- Any UI or styling work
- Any frontend testing
- Any demo where credits are short or exhausted

**Default to mock while developing.** Switch to `live` only when you are specifically testing an
integration, and switch back when you're done. Credits spent proving a button is the wrong colour
are credits you don't have for the demo.

`ALLOW_MOCK_IN_PRODUCTION=true` is required whenever any integration is still on mock — it is the
guard that stops a mock integration serving fake data to a real citizen. Set it `false` once
everything is live.
