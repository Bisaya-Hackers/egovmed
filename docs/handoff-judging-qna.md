# eGovMed — handoff: judging Q&A prep pack

**Repo:** `Bisaya-Hackers/egovmed` · **Branch:** `main` · **Commit at handoff:** `b5b97d1` · **Deployed staging:** `https://egovmed-frontend.vercel.app` + `https://egovmed-backend.vercel.app`

You're preparing a Q&A brief for eGovMed's hackathon presentation. Read the whole codebase and produce **`docs/judging-qna.pdf`** — an ordered list of the questions judges are most likely to ask, each with a **brief answer** and **2–3 followups** (each with a brief answer).

Ship the PDF. Ship a markdown source alongside it so it can be re-generated. Don't touch application code.

## The context you're briefing on

eGovMed is a Philippine public-hospital "front door" mobile web app built for the **eGov Hackathon** by UP Manila team **Bisaya-Hackers**. Pilot: **Philippine General Hospital (PGH)**. It sits on top of 8 real eGov APIs:

1. **eGovPH SSO** — login
2. **eGovAI** — Filipino AI (triage classification + history summary)
3. **National ID eVerify (PhilSys)** — identity verification
4. **Face Liveness** — anti-abuse identity capture (hosted Amazon Face Liveness redirect)
5. **eMessage** — SMS/email/in-app notifications
6. **eGovChain** — Hyperledger Besu (zero-fee, chain 13371) for tamper-evident record anchoring
7. **eGovPay** — hosted payment gateway (GCash/Maya/Card)
8. **eReport** — citizen complaint tracker

The patient flow: sign-in → symptom intake (voice or text, EN/TL) → AI triage (emergency-safety-floor guaranteed) → consent + Face Liveness → book at PGH → payment with PhilHealth auto-apply → verified records ("no repeat labs") → report an issue.

## Where to read (~2 hours of skimming, prioritized)

Read in this order:

1. **`README.md`** — one-line pitch + getting-started
2. **`egovmed_handoff.md`** and **`egovmed_dev_handoff.md`** — original team briefs (problem statement, positioning, feature list)
3. **`docs/implementation-plan.md`** — the 6-section master plan (concept, scope, user journey, API matrix, architecture, data model)
4. **`docs/design-handoff.md`** — UX intent, personas, screen inventory, accessibility bar
5. **`apidocumentation/*.md`** — the 8 API integration specs (real request/response shapes we integrated against)
6. **`docs/pentest-handoff.md`** — security posture, hardening list, threat model
7. **`docs/deploy-staging.md`** — staging deploy topology on Vercel + Upstash
8. **`docs/handoff-live-bugs.md`**, **`docs/handoff-messages-account.md`** — known outstanding work
9. **`backend/src/`** — Node/Express structure: routes, services, integrations, middleware (`secureHeaders`, `jsonComplexity`, `rateLimit`, `requireAuth`, `requireAdmin`), store (`memoryStore` + Upstash `kvStore` with Lua CAS), crypto (`v2` PHI envelope), audit log
10. **`backend/test/security.test.js`** — 11 security regression tests that pass at this commit
11. **`frontend/src/App.jsx`** — the full state machine + same-tab redirect handling for live SSO/liveness/payment
12. **`frontend/src/screens/`** — 12 screens, one per file
13. **`git log --oneline -50`** — chronological evolution, useful for "what changed and why" questions

Skim `backend/src/integrations/*.js` last to see how each API adapter really works (auth, request shape, mock vs live toggle).

## What to produce

A single PDF: **`docs/judging-qna.pdf`**, with a **markdown source** at **`docs/judging-qna.md`** so it can be re-generated.

### Structure

For each Q, this shape:

```md
### 1. What does eGovMed actually do?
**Brief:** One-paragraph answer. Direct, no jargon. Grounded in a concrete
example (Aling Rosa books at PGH, gets routed by AI, pays with PhilHealth
applied, no repeat labs).

**Follow-up: "How is this different from just an appointment app?"**
Brief. The differentiator is the 8-API rail: verified identity anchors
one portable record, tamper-evident cross-hospital labs, unified payment,
tracked complaints — not the booking itself.

**Follow-up: "Why PGH first?"**
Brief. Team is UP Manila with on-the-ground PGH experience; PGH has the
exact pain points (manual routing, repeat labs, benefit friction) that
eGov already solves for other sectors.
```

Constraints:
- **Order strictly by likelihood** — the first question is what you're 95% sure a judge opens with; the last is a niche edge case.
- **Brief means brief** — 2–4 sentences per answer. Judges' attention span is short.
- **Every answer is defensible from the code/docs.** If you can't back it, cut it.
- **Include specific numbers/proofs** where they're strong: "eGovPay balance ₱300 verified live", "11 security tests pass", "encrypted at rest with AES-256-GCM per-record IV", "rate limit 300/min global + 10/5min per-IP on auth". Judges love provable claims.
- **Bilingual acknowledgment** where relevant (EN/TL support is a market fit answer, not just an accessibility bullet).
- **Aim for 20–30 primary questions** with 2–3 followups each. Under-shipping is better than filler.

### Question categories to cover (not exhaustive — mine your own from the code)

Suggested weighting for a hackathon judging panel (technical + gov + medical):

- **Product & positioning (heaviest)** — what it is, who it's for, why it matters, differentiation, market size
- **Medical safety** — how AI triage stays safe, the emergency floor, nurse-in-the-loop, "not a diagnosis" framing
- **Privacy & compliance** — PHI at rest (AES-256-GCM), PhilSys handling, consent receipts, Data Privacy Act 2012, audit logging, what goes on-chain (hashes only, no PHI)
- **Integration story** — why 8 APIs, how they hang together, real integration proof (live eGovPay checkout, live Face Liveness, live eGovAI); the "no repeat labs" is the killer feature
- **Architecture** — Node/Express serverless on Vercel, Upstash Redis (why HTTP-based KV over Postgres — serverless connection pool), fail-hard config, atomic Lua CAS for anti-replay, single-region sin1 for PH latency
- **Frontend/UX** — 12-screen React app, bilingual EN/TL, real Web Speech + camera preview, GSAP animations, WCAG-AA tokens, no bottom-shadow flat design (matches eGovPH convention)
- **Security posture** — 11 tests pass, secureHeaders (CSP/HSTS/X-Frame/etc), timing-safe admin key, JWT rotation, prod fail-hard on weak secrets, PHI-access audit log, rate limiter shared via Upstash INCR
- **Business & scope** — free for patients, hospital-facing pricing later, kiosk client on roadmap (backend already client-agnostic), private hospitals join after PGH
- **Deployment & operations** — Vercel Hobby single-region, Upstash 10k req/day free, Vercel sensitive env vars, staging URLs live now
- **Timeline & team** — hackathon build, UPM team, split between backend + frontend + design (Claude Design + Codex + Claude), specific commit count
- **Known limitations & gotchas** — payment status stuck-pending bug (documented in `handoff-live-bugs.md`), record detail sheet layout bug, sign-in loading edge case, eGovChain still mock (needs contract deploy), eReport needs PSA location codes

### High-likelihood questions to anchor around (mine deeper — these are seeds)

- What does eGovMed do?
- Which of the 8 eGov APIs do you actually integrate, and can we see it live?
- How do you handle PHI — where does it live, is it encrypted, is any of it on-chain?
- What stops the AI from misdiagnosing someone?
- What happens if the AI can't reach eGovAI or misclassifies?
- Why blockchain for medical records? Isn't that overkill?
- How does the payment auto-apply benefits — is it real PhilHealth?
- Show us a real live redirect flow.
- What's the deploy story? Can citizens use this today?
- Is this Philippine Data Privacy Act 2012 compliant?
- Does it work in Tagalog? Voice?
- What about elderly patients who can't use apps?
- What's the kiosk plan?
- Why UP Manila? Do you have PGH endorsement?
- What's your test coverage / how do you know it's secure?
- What if eGov changes an API contract mid-year?
- What's the business model — who pays?
- Have you talked to real PGH staff?
- What happens after the hackathon?
- What's still broken today, honestly?

## How to make the PDF

Options in order of preference:

1. **Pandoc** (best output). If installed: `pandoc docs/judging-qna.md -o docs/judging-qna.pdf --pdf-engine=xelatex -V geometry:margin=0.9in -V mainfont='Segoe UI'`. Xelatex needs a TeX distribution; on Windows install MiKTeX. Fine on macOS with `brew install pandoc basictex`.
2. **Headless Chrome / Puppeteer** — write the markdown → HTML with a print stylesheet (A4, 20mm margins, `Geist` or `Inter` if available), then `chromium --headless --print-to-pdf`. Reliable across machines and no LaTeX dependency.
3. **`markdown-pdf` npm package** — quick, but formatting is basic.
4. **Fallback if you can't produce the PDF** — commit only the markdown and note in the response: *"PDF generation blocked because [reason] — the markdown source is at `docs/judging-qna.md`; convert with `pandoc docs/judging-qna.md -o docs/judging-qna.pdf` or upload to a markdown-to-PDF converter."* Do not fake a PDF.

The PDF should look like a briefing doc, not a design piece. Simple heading hierarchy, generous white space, no color fills. Judges read it once before walking on stage.

### Style rules

- Cover page: title (eGovMed — Judging Q&A Prep), one-line tagline (from README), team name (Bisaya-Hackers), date, commit hash, live URLs.
- Table of contents auto-generated.
- Each question in a `H3` with an ordered number. Followups in bold-labeled paragraphs, not nested lists.
- Footer with page numbers.
- Include an appendix with the 8 API list, a data-flow diagram (ASCII from `docs/implementation-plan.md` is fine), and a "cheat sheet" of numbers-you'd-cite-on-stage.

## What NOT to do

- **Don't modify application code** — this is a documentation task only.
- **Don't invent facts.** If something isn't in the code or docs, either mine harder or omit the question. Judges will fact-check on the spot.
- **Don't over-promise** — the app has known bugs (payment stuck, record sheet layout, signin loading). Answer honestly if asked; frame as "shipped 3 of the 4 headline flows live in 72 hours".
- **Don't produce a wall of text.** If the doc exceeds 25 pages, cut questions, not detail per question.
- **Don't use `Co-Authored-By: Claude`** on the commit — the user explicitly wants StarRayX-only authorship.

## Commit style

- Author: `StarRayX <40836712+StarRayX@users.noreply.github.com>`
- One commit for the markdown + PDF together
- Message: `docs: judging Q&A prep pack (markdown + PDF)`
- No `Co-Authored-By: Claude` trailer

## What "done" looks like

- **`docs/judging-qna.md`** committed — 20–30 primary questions, each with a brief answer + 2–3 followups, in strict likelihood order, defensible from the codebase.
- **`docs/judging-qna.pdf`** committed alongside it (or a clear note if PDF generation was blocked and how to run it).
- Pushed to `main`.
- A short chat summary listing the top 5 questions with their briefs, so the user has an at-a-glance reference without opening the PDF.

Good luck.
