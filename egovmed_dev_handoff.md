# eGovMed — Developer Handoff (TL;DR)

*Paste this into any AI to develop from. Hackathon project on the eGov API stack. Pilot: Philippine General Hospital (PGH).*

---

## What we're building

**The smart front door to public healthcare** — a phone/web **app** that runs an **AI triage + verified-identity + portable-records + payments** layer on top of the 8 eGov APIs.

**Core value:** cut the lines and red tape at PGH. Patients don't re-enter data, don't repeat labs, get benefits auto-applied, and are routed to the right department by AI instead of being hand-sorted by non-medical staff.

**Roadmap (NOT building yet — do not scope this):** a lobby **kiosk** version of the same product for walk-in patients with no phone, no ID, or low literacy (in-session enrollment, assisted mode). It reuses the exact same backend as a second client. Keep it in mind as a future direction and keep the backend client-agnostic, but **build only the app for now** — no kiosk UI, no enrollment flow this round.

---

## Primary flow (this is also the demo)

1. **Log in** with existing eGov account → profile auto-fills (no manual data entry).
2. **Describe symptoms** (Tagalog OK) → AI triage routes to the correct specialty and flags red-flag/emergency cases.
3. **Verify identity** against PhilSys with consent + face-liveness (anti-abuse).
4. **Book + reminders** sent to the verified contact.
5. **Doctor visit:** AI-summarized history; labs from other hospitals shown as verified → **no repeat labs**.
6. **Pay:** bill settled with PhilHealth / white card / SSS auto-applied; remainder paid on any channel.
7. **Issues:** filed + tracked by case number, auto-escalated past a time limit, and fed back to improve triage.

---

## The 8 eGov API integrations (all used)

| API | Role in the build |
|---|---|
| **eGovPH (SSO)** | Auth. Login → session; pull profile to auto-fill the patient record. |
| **eGov AI** | Triage engine: symptom intake + Tagalog translation → classify to specialty + urgency (structured JSON); summarizes patient history for doctors. |
| **National ID eVerify** | Verify identity against PhilSys with consent; gate record access. |
| **Face Liveness** | Create liveness session → confirm a live person during ID capture (anti-abuse). |
| **eMessage** | Send appointment confirmations, reminders, and "results ready" to the verified contact (SMS/email/in-app). |
| **eGovChain** | Anchor record **hashes/pointers** on-chain via JSON-RPC (Hyperledger Besu) for tamper-evident, cross-hospital trust → **no repeat labs**. |
| **eGovPay** | Settle the bill through the unified gateway; apply benefits; multi-channel payment. |
| **eReport** | File/track issues by case number (OTP-verified); escalate past a threshold; AI mines recurring errors to retrain triage. |

---

## Key entities (minimal data model)

- **Patient** — linked to eGov / PhilSys ID; profile from SSO.
- **HealthRecord** — labs, vitals, history; stored **encrypted off-chain**, fingerprint/hash **anchored on eGovChain**.
- **Appointment** — patient, specialty, hospital, status, queue number.
- **TriageResult** — input symptoms, predicted specialty, urgency/red-flag.
- **Payment** — bill, benefits applied, balance, channel.
- **Report** — issue, case number, status, escalation timer.

---

## Build notes (important)

- **Identity is the anchor.** The eGov/PhilSys ID *is* the patient profile — records, appointments, and payments all key off it.
- **Triage = decision support**, not diagnosis: it pre-sorts and red-flag-routes; a nurse confirms. Model output must always include an urgency flag.
- **eGovChain stores only hashes/pointers.** Raw PHI stays encrypted off-chain (Data Privacy Act 2012).
- **Keep the backend client-agnostic** so a kiosk client can plug in later — but do **not** build the kiosk this round.

---

## Demo scope (what to actually build vs. fake)

- **Build live:** AI triage — symptom text/voice (incl. Tagalog) → specialty + red-flag, as structured output.
- **Mock / UI-only:** verified-record badge ("Lab result verified from another hospital ✓"), eGovPay checkout with PhilHealth auto-applied.
- **Click-through only:** login, eMessage, Face Liveness, eReport steps.
- **Out of scope:** kiosk (roadmap only).

---

## Suggested stack (AI may substitute)

- **Frontend:** React (web app); React Native if a native app is wanted.
- **Backend:** Node/Express or Python/FastAPI.
- **AI triage:** LLM with a system prompt that classifies symptoms → `{specialty, urgency, red_flags}` JSON; add Tagalog↔English translation.
- **Integrations:** call each eGov API per the table; blockchain anchoring via JSON-RPC (Hyperledger Besu).

---

## Glossary

**PGH** – Philippine General Hospital (public, UP-run). **PhilSys** – national ID system. **PhilHealth** – national health insurance. **"White card"** – indigent/medical-assistance card for free/discounted public-hospital care. **SSS** – Social Security System. **Triage** – sorting patients to the right specialty/urgency.
