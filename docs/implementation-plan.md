# eGovMed — Implementation Plan (Hackathon Prototype)

*Scope decided: **app-first** this round (phone/web). Backend = **Node/Express**. Kiosk = roadmap. 8 eGov APIs, no DBM Compass. UI/UX is being produced separately by Claude Design — see [design-handoff.md](design-handoff.md); this plan stays deliberately light on visual detail.*

---

## 1. Refined project concept

**Name.** Keep **eGovMed** as the platform codename (and repo name). Public-facing pitch name: **eGovMed — the eGov Health Rail**. (Optional Filipino hero name for the pitch deck: **Lusog**, "robust health." Not required; codename stays eGovMed.)

**One-line pitch.**
> eGovMed is the eGov health rail: one login, one verified medical record, one payment — so patients at PGH stop re-entering their data, stop repeating labs, and stop lining up to pay.

**The single central problem.**
> Public hospitals like PGH don't reuse or trust the identity, records, and payment rails the government *already* operates — so non-medical staff hand-sort patients, contact details are re-validated by hand, labs are needlessly repeated, and benefits are applied slowly in long lines. The waste falls hardest on low-income, elderly, and provincial patients.

**Why healthcare + kiosk is coherent (not two products).**
The kiosk is not a separate product — it's a *second client on the same rail*. The hard part is the backend: a verified identity that keys a portable record, tamper-evident cross-hospital trust, and unified payment. Once that rail exists, the phone app serves people who have a smartphone, and the kiosk serves the same workflow for people who don't (no phone, low literacy, elderly, provincial). Same account, same record, same transaction — different physical access point. Building the app first proves the rail; the kiosk later widens the door without rebuilding anything. That's why the backend is **client-agnostic** from day one.

---

## 2. Product scope

### a. Hackathon MVP (build this round)
- **eGovPH SSO login** → auto-filled patient profile (no manual entry).
- **AI triage** (the live centerpiece): symptom text/voice, English + Tagalog → structured `{specialty, urgency, red_flags}`. Red-flag → "seek immediate human medical assessment."
- **Identity verification**: National ID eVerify (consent) + Face Liveness step-up (anti-abuse).
- **Appointment booking** + **eMessage** confirmation/reminders to the verified contact.
- **Verified-record badge**: "Lab result verified from another hospital ✓," backed by an **eGovChain** hash-anchor + verify.
- **eGovPay checkout** with benefits (PhilHealth / white card / SSS) shown as **clearly-labeled mocks**.
- **eReport**: file + track an issue by case number (OTP-verified).

### b. Near-term pilot at PGH
- Real integration sandboxes for each API; a handful of real PGH departments in the routing map.
- Staff-facing view for a nurse to confirm/override AI routing (decision-support, human-in-the-loop).
- Real eGovChain network (Besu) for record anchoring across ≥2 cooperating facilities.
- Payment reconciliation against a real accredited channel; benefit rules still gated behind real PhilHealth/SSS integrations when/if exposed.

### c. Long-term national vision
- Every public hospital, then private hospitals, on the same rail.
- The **kiosk client** rolled out to barangay/LGU/library computers as installable software (no custom hardware), with assisted mode and in-session enrollment.
- Cross-facility record portability nationwide; issue-report analytics that retrain triage.

### Strictly cut from the MVP (do NOT build this round)
- ❌ Kiosk UI, assisted mode, in-session enrollment (roadmap only).
- ❌ Real PhilHealth / SSS / white-card benefit engines (mock + label).
- ❌ Real hospital EMR / national medical repository integrations (mock + label).
- ❌ Passport / any non-PhilSys identity (National ID eVerify only).
- ❌ Doctor-facing EMR beyond a read-only "AI-summarized history" demo panel.
- ❌ Multi-hospital production data sync (demo two facilities via anchored hashes only).

---

## 3. Complete user journey

### a. Smartphone / eGovPH user (the demo path)
1. Opens the eGovMed app → **Sign in with eGovPH (SSO)**. Profile, contact, PhilSys ID auto-fill.
2. **Describe symptoms** by text or voice, Tagalog or English. AI returns a suggested specialty + urgency; red flags trigger an emergency instruction.
3. **Verify identity**: National ID eVerify (consent shown + recorded) → **Face Liveness** step-up.
4. **Book** the appointment for the routed specialty → **eMessage** sends the reference number + prep instructions to the verified contact.
5. **At the visit**: doctor sees an **AI-summarized history**; labs from other hospitals appear **verified ✓** (eGovChain-anchored) → no repeat labs. A nurse confirms the routing.
6. **Pay**: eGovPay shows the bill with benefits applied (mock-labeled) → pays remaining balance on any channel.
7. **If something breaks**: files an **eReport** case (OTP-verified), gets a case number, tracks status; escalates past a threshold.

### b. Kiosk-assisted user (roadmap — described for continuity, not built this round)
1. Walks up to a PGH/barangay kiosk; staff launches **assisted mode** (scoped, no full account access).
2. Signs in or recovers eGovPH; if unenrolled, **in-session enrollment** (future).
3. Same eVerify + Face Liveness at the kiosk camera.
4. Speaks symptoms in Tagalog; large-text, voice-first UI. Scans a paper referral/prescription → eGovAI extracts fields.
5. Same booking + eMessage; reference number printed/SMS'd.
6. Same eGovPay; can pay at an accredited channel and reconcile.
7. Auto-logout, masked data, no local file retention on the shared machine.

### Moving a session between channels
The **session is keyed to the PhilSys/eGov identity, not the device.** A transaction started on the kiosk (e.g., booked appointment `APT-1234`) is retrievable later in the phone app or another kiosk by signing in — because appointments, records, and payments all reference the same citizen ID. eMessage carries the reference number across channels (SMS instructions the patient can act on anywhere). Backend is stateless-per-client; state lives server-side against the identity.

---

## 4. API implementation matrix

*All 8 required APIs. Each entry: feature · inputs · outputs · user-visible result · backend role · fallback/mock · why it's genuinely needed.*

### eGovPH SSO
- **Feature:** Login + profile auto-fill.
- **Inputs:** OIDC auth code from the eGovPH login redirect.
- **Outputs:** ID token + profile (name, contact, PhilSys ref).
- **User sees:** "Signed in as … " with pre-filled details; no typing.
- **Backend:** OIDC code exchange → session (JWT/cookie); hydrate the Citizen record.
- **Fallback/mock:** Local mock IdP issuing a seeded profile if the sandbox is unavailable.
- **Why needed:** Identity is the anchor for every record, appointment, and payment; SSO removes manual data entry — the core value.

### National ID eVerify
- **Feature:** Confirm the patient against PhilSys, with consent, to gate record access.
- **Inputs:** PhilSys reference / demographic fields + explicit consent flag.
- **Outputs:** Verified match result + a consent receipt.
- **User sees:** "Identity verified ✓" and a consent prompt they must accept.
- **Backend:** Call eVerify; persist an IdentityVerificationResult + ConsentRecord; unlock record access.
- **Fallback/mock:** Mock verifier returning a consented match for seeded PhilSys IDs.
- **Why needed:** Records/benefits must be released only to the verified person; consent is legally required (Data Privacy Act).

### Face Liveness
- **Feature:** Confirm a live person during ID capture (anti-abuse step-up).
- **Inputs:** Liveness session + camera capture.
- **Outputs:** Liveness pass/fail + score.
- **User sees:** A quick "look at the camera" check → "Live person confirmed ✓."
- **Backend:** Create liveness session; bind result to the verification event.
- **Fallback/mock:** Webcam capture stub that returns pass (click-through) if the API is unavailable.
- **Why needed:** Prevents someone booking/claiming benefits with a stolen photo/ID; fairness + anti-fraud.

### eGovAI
- **Feature:** Symptom triage + Tagalog↔English translation → structured routing; doctor history summaries. **(Built live.)**
- **Inputs:** Free-text/voice symptoms (either language); optionally extracted document text.
- **Outputs:** `{specialty, urgency, red_flags[]}` JSON; plain-language summary.
- **User sees:** Suggested department + urgency; red-flag → emergency instruction. Doctor sees a summary.
- **Backend:** Prompted LLM call with a strict JSON schema + guardrails; store IntakeRecord + TriageResult.
- **Fallback/mock:** Local LLM/prompt with the same schema if the gov endpoint is down.
- **Why needed:** Replaces slow, inaccurate manual sorting by non-medical staff — the headline improvement. **Decision support, never diagnosis.**

### eMessage
- **Feature:** Confirmations, reminders, "results ready" via SMS/email/in-app.
- **Inputs:** Verified contact + message template + reference number.
- **Outputs:** Delivery receipt/status.
- **User sees:** An SMS/email/app notification with their reference and prep instructions.
- **Backend:** Enqueue + send on appointment/result events; record delivery status.
- **Fallback/mock:** UI toast + a "sent messages" log panel if the sandbox is unavailable.
- **Why needed:** Poor/illiterate patients are often unreachable; messaging the *verified* contact closes the follow-up loop.

### eGovChain
- **Feature:** Anchor record **hashes/pointers** (not PHI) on Besu for tamper-evident, cross-hospital trust.
- **Inputs:** SHA-256 of a record/document + metadata (facility, timestamp, consent ref).
- **Outputs:** Transaction hash / receipt.
- **User sees:** "Lab result verified from another hospital ✓" (verify = recompute hash, compare on-chain).
- **Backend:** JSON-RPC to Besu; call an anchor smart contract; store the tx hash against the record.
- **Fallback/mock:** Local mock chain (in-memory/SQLite) issuing deterministic tx hashes, or a public Besu devnet.
- **Why needed:** The only trusted way to reuse another facility's lab → **no repeat labs**. Hashes only; raw PHI stays encrypted off-chain.

### eGovPay
- **Feature:** Settle the hospital bill through the unified gateway; multi-channel.
- **Inputs:** Bill amount, benefit lines (mock), citizen ref.
- **Outputs:** Payment intent + settlement status.
- **User sees:** A checkout with benefits applied (clearly labeled mock) and a payable balance; pays on any channel.
- **Backend:** Create payment intent; reconcile settlement; store Payment.
- **Fallback/mock:** Mock checkout that simulates settlement; benefit lines labeled "mock / pending real integration."
- **Why needed:** Removes the separate payment line and manual benefit handling — concrete friction removed.

### eReport
- **Feature:** File + track an issue by case number (OTP-verified); escalate.
- **Inputs:** Issue category + description + OTP.
- **Outputs:** Case number + status.
- **User sees:** "Case #… filed"; a status tracker; escalation after a time threshold.
- **Backend:** Create case; poll/track status; escalation timer; feed recurring categories back to triage tuning.
- **Fallback/mock:** Mock case service issuing a case number + status transitions.
- **Why needed:** Accountability for wrong routing/billing/misconduct; the feedback loop that improves triage over time.

---

## 5. System architecture

**Frontend surfaces (this round):** one **React (mobile-first web) app**. Kiosk is a future second client of the same API — not built now, but the API contract stays client-agnostic. *Screen design is owned by Claude Design (see [design-handoff.md](design-handoff.md)).*

**Backend services (Node/Express, modular):**
- `auth` — eGovPH OIDC, session/JWT, authz guards.
- `identity` — eVerify + Face Liveness orchestration, consent receipts.
- `intake` — symptom capture + eGovAI triage, structured output validation.
- `documents` — upload → eGovAI extraction → hash.
- `records` — medical records (encrypted off-chain) + verified-badge logic.
- `chain` — eGovChain anchor/verify via JSON-RPC.
- `appointments` — booking + status.
- `payments` — eGovPay intents + reconciliation.
- `notifications` — eMessage dispatch + delivery status.
- `reports` — eReport case create/track/escalate.

**Database/storage:** PostgreSQL (entities + audit log); object storage (encrypted blobs) for scanned documents; nothing sensitive on-chain. Secrets in `.env` (gitignored) → managed secrets in deploy.

**Cloud deployment:** containerized API + Postgres; static host for the React app; a Besu endpoint (sandbox/devnet) for anchoring. Single environment for the demo; env-driven config.

**API orchestration:** each external API behind a thin **adapter** with a uniform interface and a **mock implementation** toggled by env — so the demo runs fully even if a sandbox is down, and real endpoints drop in without touching business logic.

**Text architecture diagram:**

```
                 ┌──────────────────────────────────────────────┐
                 │        React app (mobile-first web)           │
                 │  [design owned by Claude Design]              │
                 │   — kiosk = future 2nd client, same API —     │
                 └───────────────────────┬──────────────────────┘
                                         │ HTTPS / JSON
                                         ▼
                 ┌──────────────────────────────────────────────┐
                 │            Node/Express API                   │
                 │  auth · identity · intake · documents ·       │
                 │  records · chain · appointments · payments ·  │
                 │  notifications · reports                      │
                 └──┬───────┬────────┬───────┬────────┬─────────┘
                    │       │        │       │        │
        ┌───────────┘  ┌────┘   ┌────┘  ┌────┘   ┌────┘
        ▼              ▼        ▼       ▼        ▼
   ┌─────────┐   ┌──────────┐ ┌─────┐ ┌───────┐ ┌────────┐
   │ Postgres│   │ Object   │ │Besu │ │ eGov   │ │ Adapter│
   │ +audit  │   │ storage  │ │JSON │ │ APIs   │ │ mocks  │
   │         │   │(encrypted│ │-RPC │ │ (SSO,  │ │(env    │
   │         │   │ blobs)   │ │     │ │ eVerify│ │ toggle)│
   └─────────┘   └──────────┘ └─────┘ │ Face,  │ └────────┘
                                      │ eGovAI,│
                                      │ eMsg,  │
                                      │ eGovPay│
                                      │ eReport│
                                      └────────┘
```

**Document-processing flow:** upload → virus/type check → eGovAI extraction (referral/prescription/lab/ID) → structured fields into IntakeRecord → SHA-256 hash → anchor via `chain` → encrypted blob to object storage; original never stored on the client, purged from kiosk sessions.

**Authentication & authorization:** eGovPH OIDC establishes the session; record access is gated behind a **verified** identity (eVerify + liveness) and a valid ConsentRecord. Assisted/staff mode (future) gets a scoped token — can help operate the flow, **cannot** read the full account. Every access is written to an audit log.

**eGovChain anchoring flow:** `record/doc → SHA-256 → anchor contract (JSON-RPC to Besu) → store tx hash`. Verify: recompute hash → compare against on-chain value → render "verified ✓." Only hashes/pointers/consent refs/timestamps on-chain; PHI encrypted off-chain (Data Privacy Act 2012).

**Payment flow:** compute bill → attach benefit lines (mock-labeled) → eGovPay payment intent → user pays on a channel → reconcile settlement → mark Payment settled → eMessage receipt.

**Reporting flow:** user opens a case → OTP (eReport) → case number issued → status tracked → escalation timer fires past threshold → recurring categories aggregated to inform triage tuning.

**Notification flow:** domain events (appointment booked, result ready, payment settled, case filed) → `notifications` → eMessage (SMS/email/in-app) to the **verified** contact → delivery status stored.

---

## 6. Data model

*Core entities and important fields. PHI stays encrypted off-chain; only hashes are anchored.*

**Citizen**
`id`, `philsys_ref` (verified), `egov_sub` (SSO subject), `full_name`, `contact` (verified phone/email), `dob`, `preferred_language` (en/tl), `created_at`. *Anchor for everything.*

**KioskSession** *(schema now, client later)*
`id`, `citizen_id`, `channel` (app | kiosk), `assisted_by_staff_id?` (scoped), `started_at`, `last_activity_at`, `expires_at`, `masked` (bool), `no_local_retention` (bool). *Enables cross-channel continuity + privacy timeouts.*

**ConsentRecord**
`id`, `citizen_id`, `scope` (identity_verify | record_access | payment), `granted` (bool), `granted_at`, `evidence_ref` (eVerify consent receipt), `expires_at?`.

**IdentityVerificationResult**
`id`, `citizen_id`, `method` (everify + face_liveness), `match` (bool), `liveness_pass` (bool), `liveness_score`, `consent_id`, `verified_at`, `provider_ref`.

**IntakeRecord**
`id`, `citizen_id`, `session_id`, `raw_input`, `input_language`, `input_mode` (text | voice), `translated_text?`, `created_at`. → links to TriageResult.

**TriageResult**
`id`, `intake_id`, `specialty`, `urgency` (routine | urgent | emergency), `red_flags[]`, `model_version`, `confirmed_by_staff_id?` (human-in-the-loop), `created_at`. *Always carries an urgency flag.*

**ScannedDocument**
`id`, `citizen_id`, `type` (referral | prescription | lab | id | form), `storage_ref` (encrypted blob), `extracted_fields` (jsonb), `sha256`, `chain_tx_hash?`, `uploaded_at`. *Original purged from client/kiosk.*

**Appointment / ServiceRequest**
`id`, `citizen_id`, `specialty`, `hospital` (PGH), `status` (requested | booked | seen | cancelled), `queue_number?`, `reference_no`, `scheduled_for`, `created_at`. *Retrievable across channels by citizen_id.*

**MedicalRecord**
`id`, `citizen_id`, `type` (lab | vitals | history), `storage_ref` (encrypted off-chain), `sha256`, `chain_tx_hash`, `source_facility`, `verified` (bool, from on-chain compare), `created_at`. *Fingerprint anchored on eGovChain; enables "no repeat labs."*

**Payment**
`id`, `citizen_id`, `appointment_id?`, `amount_total`, `benefit_lines[]` (mock-labeled: philhealth/white_card/sss), `amount_payable`, `channel`, `status` (pending | settled), `egovpay_ref`, `settled_at`.

**Report / Case**
`id`, `citizen_id`, `category` (routing | billing | access | misconduct | technical), `description`, `case_number`, `status`, `otp_verified` (bool), `escalated` (bool), `escalation_due_at`, `created_at`.

---

### Cross-cutting rules (repeat, because they matter)
1. `.env` holds all secrets and is gitignored.
2. Triage = decision support, not diagnosis; a human confirms; urgent → seek immediate human assessment.
3. Only hashes/pointers/consent/timestamps on eGovChain; PHI encrypted off-chain.
4. Benefits + hospital/EMR + national repositories are **mocks / clearly-labeled future integrations**.
5. National ID eVerify is the only identity source — no passport claims.
