# eGovMed — Project Handoff

*Everything a teammate needs to understand the project in one read.*

---

## One line

**A government-backed health rail built on eGov — one login, one medical record, one payment — so patients at PGH (and eventually every public and private hospital) stop re-entering their data, stop repeating labs, and stop lining up to pay.**

**Team:** A team from UP Manila (UPM) with hands-on experience at PGH, building for the **eGov Hackathon**, which released 9 government APIs for teams to integrate. Our project is a *proposed API integration* that connects healthcare into the eGov ecosystem.

---

## The 30-second version

A patient opens the eGov app they already have, describes their symptoms, and is automatically routed by AI to the right hospital department. They book an appointment, then show up to a doctor who can already see their full, verified medical history — so there are no repeat lab tests. They pay their bill in the same app with PhilHealth and other benefits applied automatically. If anything goes wrong along the way, they file a report that the system tracks, escalates, and learns from. All of this runs on the identity, records, and payment tools eGov already provides.

---

## The problem we're solving (what PGH looks like today)

The hospital doesn't reuse or trust data the government *already has*, which creates four kinds of waste:

1. **Manual routing.** Non-medical staff (often compsci people, not doctors or nurses) hand-sort patients into departments like Internal Medicine or Gastroenterology. It's slow and often inaccurate.
2. **Data re-validation.** Staff spend hours validating names and contact numbers. Many patients are poor, sometimes illiterate, and give incorrect details — so they can't be reached afterward.
3. **Repeat labs.** There's no trusted way to reuse a lab result from another facility, so patients re-test and pay again — a real burden for people with little money.
4. **Payment and benefits friction.** Long lines to pay, and PhilHealth / "white card" (indigent) / SSS deductions are handled manually and slowly.

**Our thesis:** eGov already solved identity, payments, and verifiable records for other sectors. Healthcare just needs to plug in.

---

## How it works — the patient journey

This is the complete flow, start to finish:

1. **Log in.** The patient signs in with their existing eGov account. Their profile, contact info, and ID fill in automatically — no re-typing, no staff re-validating anything.
2. **Describe symptoms.** The patient types or speaks their symptoms (including in Tagalog). AI understands them, routes the patient to the correct specialty, and flags anything urgent.
3. **Confirm identity.** The system verifies the patient is who they say they are against the national ID system, with consent, and confirms a real live person is present.
4. **Book + get reminders.** The appointment is booked, and the patient receives confirmations, reminders, and a "results ready" notice sent to their verified contact.
5. **See the doctor.** The doctor pulls up an AI-summarized medical history. Lab results from *other* hospitals show up as trusted and verified — so no repeat labs.
6. **Pay.** The bill appears with PhilHealth / white card / SSS benefits already applied. The patient pays the remaining balance through any channel — no separate payment line.
7. **Report issues (if needed).** If something goes wrong (wrong department, billing dispute, no-show), the patient files a tracked report with a case number. The system escalates it if it isn't resolved in time, and learns from recurring errors to improve automatically.

---

## The features, in detail

**Public and private, public first.** The platform is designed to link both the public and private health sectors into eGov. Public hospitals like PGH go first, with private hospitals joining later.

**Smart auto-triage.** Instead of non-medical staff manually assigning patients, AI does the first-pass routing to the right specialty and highlights urgent cases — faster and more consistent.

**One portable, verifiable medical record.** Medical history, labs, and vital statistics live in one place tied to the patient's eGov identity. Records are anchored on the government blockchain so any participating hospital can trust results from another, which is what eliminates repeat testing. AI can summarize a patient's history so doctors analyze faster.

**Your eGov account is your patient profile.** Because the identity is already validated by the government, staff no longer waste time chasing valid names and contact numbers, and patients are reachable for follow-ups.

**Verified appointments.** National ID verification and face-liveness confirm the real person is making the appointment, keeping the system accurate and fair.

**Pay + benefits in one place.** Balances are settled in-app, with PhilHealth / white card / SSS benefits deducted automatically and the rest payable through any accredited channel.

**Built-in issue tracking that learns.** Every problem is logged, tracked by case number, auto-escalated if it stays unresolved past a set time, and analyzed for repeating patterns so the system keeps improving.

**Designed for real PGH patients.** Works for everyone, including an assisted / kiosk mode so hospital or barangay staff can help patients who aren't comfortable with apps, with Tagalog and voice support.

---

## Which eGov APIs we use

| Step / feature | eGov API | What it does for us |
|---|---|---|
| Login + auto-filled profile | **eGovPH (SSO)** | Patients sign in with their existing eGov account; profile, contact, and ID fill in automatically. |
| Symptom intake + auto-triage | **eGov AI** | Understands symptoms (including Tagalog), routes patients to the correct specialty, flags urgent cases, and summarizes history for doctors. |
| Identity confirmation | **National ID eVerify** | Confirms the patient's identity against the national ID system, with consent built in. |
| Anti-fraud identity capture | **Face Liveness** | Confirms a real, live person is present — not a photo or someone else. |
| Appointment updates | **eMessage** | Sends confirmations, reminders, and "results ready" notices by SMS, email, and in-app. |
| Verified, shareable records | **eGovChain** | Anchors record fingerprints on the government blockchain so any hospital can trust results from another — no repeat labs. |
| Payments + benefits | **eGovPay** | Settles the hospital bill through one gateway; benefits are applied and the balance is paid on any channel. |
| Issue reporting + learning | **eReport** | Lets patients file and track issues by case number; the system escalates and learns from recurring ones. |
| *(Optional)* Impact dashboard | **DBM Compass** | Shows money and staff-hours saved, benchmarked against the hospital's public budget allocation. |

The idea meaningfully uses **8 of the 9** catalog APIs, with **DBM Compass** as an optional impact/transparency layer — so it exercises nearly the entire eGov stack.

---

## What makes it stand out

- **No more repeat labs.** Verifiable, cross-hospital records mean patients don't pay twice for the same test — a rare, concrete, and genuinely useful role for government blockchain.
- **AI replaces manual patient routing.** The department-sorting that non-medical staff used to do by hand is now automatic, faster, and more consistent.
- **A system that improves itself.** Reported issues feed back into the AI, so triage and the overall experience get better over time.

---

## What we're building for the demo

For the hackathon, we'll walk through the **complete patient journey at PGH**, end to end: log in → describe symptoms → auto-triage → verify → book → doctor sees verified records → pay with benefits applied → (and, if something breaks) file and track an issue. One hospital, the full flow, so the whole idea is visible in a single run.

---

## Glossary (for any teammate)

- **eGov / eGovPH** — the Philippine government's digital super-app and its single sign-on for partners.
- **PGH** — Philippine General Hospital, a large public hospital in Manila run by UP; our primary target.
- **UPM** — University of the Philippines Manila (our team's background).
- **PhilSys / National ID** — the national identification system our verification checks against.
- **PhilHealth** — the national health insurance program.
- **"White card"** — an indigent/medical-assistance card for free or discounted care at public hospitals.
- **SSS** — Social Security System.
- **Triage** — sorting patients to the correct medical specialty or level of urgency.
