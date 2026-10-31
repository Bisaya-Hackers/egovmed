# eGovMed: demo video checklist

For the 3-minute submission video. The two things being marked are **a live working demo** and
**DICT API implementation**, so every shot below is chosen to show a real government API
responding, not a UI walkthrough.

**App:** https://egovmed.vercel.app · **Sign in:** mobile `+639090000001`, code `123456`, PIN `000000`
(the sign-in dialog lists all five accounts and keeps them on screen through every step)

---

## Before you hit record

- [ ] Open the app once and sign in, then sign out. First load wakes a cold serverless function
      and adds a few seconds of nothing happening.
- [ ] Phone on Do Not Disturb, but **keep SMS visible**. The arriving text is the proof shot.
- [ ] Record portrait, on a real phone. It is a citizen app.

---

## The run (2:00–2:30 of screen time)

| # | Do this | What it proves | API |
|---|---|---|---|
| 1 | Tap **Login via eGovPH**, sign in with `+639090000001` | Real eGovPH sign-in in a browser, no pasted codes. Say out loud: **the name and profile that fill in came from PhilSys, we typed nothing** | **eGovPH SSO** |
| 2 | **Start a visit**, describe symptoms in Taglish | Live AI triage returning specialty + urgency + red flags. Show that it answered a mixed-language sentence | **eGov AI** |
| 3 | Consent, then **verify identity** with the face capture | Liveness capture, then a PhilSys demographic match under recorded consent | **Face Liveness** + **eVerify** |
| 4 | **Book** the appointment | Queue number on screen, then cut to **the SMS landing on the phone** | **eMessage** |
| 5 | Open **Records**, tap a record, show the **content hash and chain tx** | Records anchored on-chain, hash only. Say: **no patient data goes on the chain, only the fingerprint** | **eGovChain** |
| 6 | Open **Payments**, start a payment | Hosted government checkout with statutory discounts applied | **eGovPay** |
| 7 | Open **Report**, file one, show the **case number** | Complaint filed into the real government queue, OTP-gated | **eReport** (+ eMessage for the code) |

That is all eight APIs in seven actions.

---

## Say these three things somewhere

They are the difference between "a nice app" and "a real integration":

1. **"All eight eGov APIs are live in production."** Not mocked, not simulated. On the API
   Developer Portal gateway.
2. **"Identity is the anchor."** One eGovPH login carries the patient through triage, booking,
   payment and records. Nothing is re-typed.
3. **"Records are anchored by hash only."** The chain proves nothing was tampered with, and it
   never sees a name, a facility, or a diagnosis.

---

## Do not

- Do not re-run triage to get a better answer on camera. Every AI call spends one of a shared
  500-credit pool.
- Do not book twice for a better SMS shot. Book once, film the phone.
- Do not say "champion" or "1st place". Ten winning teams, no ranking between them.
- Do not show the mobile number the SMS arrives on if it is a personal one.

---

## If something breaks mid-take

- **Sign-in dialog shows nothing.** Reload once. The widget script is loaded from
  `widgets.e.gov.ph` and a cold start can lose the race.
- **Triage is slow.** It is a real generation call. Let it run; the wait is honest.
- **SMS does not arrive.** Keep going. The confirmation is on screen either way; the text is a
  bonus shot, not the demo.
