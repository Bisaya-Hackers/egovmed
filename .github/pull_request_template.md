<!--
Title: <type>(<scope>): <imperative summary>   e.g. fix(http): guard outbound requests against SSRF
This body becomes the squash commit message on main. Write it for whoever reads it in six months.
-->

## What changed

## Why

<!-- The reasoning, especially if the obvious approach was rejected. This is the part that
     does not survive anywhere else. -->

## Verification

- [ ] `cd backend && npm test` passes (19/19)
- [ ] Integration adapters still work in **both** `mock` and `live` modes
- [ ] No secrets in the diff

## Invariants

<!-- Delete this line if untouched. Otherwise name which one and justify it.
     Full list in CONTRIBUTING.md "Load-bearing invariants": single-use liveness CAS, triage
     emergency floor, hash-only anchoring, SSRF guard, dual-version record decryptor,
     patientIdFor derivation, security middleware stack. -->

None touched.
