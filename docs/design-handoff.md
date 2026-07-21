# eGovMed — Design Handoff for Claude Design

*This is a **brief handed TO the design team (Claude Design)** to produce the app UI/UX. It defines who we're designing for, the screens to design, the flows they support, required states, content/tone, accessibility, and visual direction. The engineering context lives in [implementation-plan.md](implementation-plan.md); this doc is the source of truth for the interface.*

> **Deliverable requested:** mobile-first web app screens (React) with all states, a small reusable component set, a flow map, and design tokens. **Not** kiosk screens this round (roadmap) — but design touch-friendly, large-text-capable components so the same system scales to a kiosk later.

---

## 1. Product in one paragraph

eGovMed is a government health rail on top of the eGov API stack. A patient signs in with their existing eGov account, describes symptoms (English or Tagalog, typed or spoken), gets routed by AI to the right hospital department, verifies their identity, books an appointment, sees lab results verified from other hospitals (so no repeat labs), pays with benefits applied, and can file a tracked report if something goes wrong. Pilot hospital: **PGH (Philippine General Hospital)**.

**The interface must feel trustworthy, calm, and effortless — a government service people rely on when they're anxious and possibly unwell.** It should not feel like a flashy consumer app or a sterile government form.

---

## 2. Who we're designing for (personas)

Design for the *hardest* users; everyone else benefits.

1. **Aling Rosa, 63, provincial patient.** Basic Android phone, small data plan, reads slowly, more comfortable in Tagalog. Needs large text, voice input, very few steps, obvious "what do I do next."
2. **Mark, 28, low-income Manila resident.** Comfortable with phones, low patience for forms, limited data. Wants speed and no re-typing.
3. **Nurse/staff (secondary, light).** Confirms AI routing (human-in-the-loop). Sees a read-only summarized history. Not a full EMR.

**Design implications:** plain language over jargon, one primary action per screen, generous tap targets, voice as a first-class input, an always-visible EN/TL toggle, and reassurance/trust cues throughout.

---

## 3. Design principles

1. **One decision per screen.** A single obvious primary action; everything else secondary.
2. **Bilingual by default.** EN/TL toggle persistent; nothing English-only.
3. **Voice is first-class**, not an afterthought — especially on symptom intake.
4. **Trust, visibly.** Verification, consent, and "verified ✓" states should feel official and reassuring.
5. **Safety over cleverness.** Never imply diagnosis. Red-flag/emergency states are unmistakable and tell the person to seek immediate human help.
6. **Legible for older eyes.** High contrast, large base type, no thin gray-on-gray.
7. **Privacy on a shared/public context** (kiosk-ready): support masked data, session timeout, and a clear logout — even though we ship the app first.

---

## 4. Visual direction (proposed — you own the final)

- **Mood:** trustworthy · calm · clinical-but-warm · governmental without being bureaucratic.
- **Palette suggestion:** a dependable primary blue/teal; clean neutral surfaces; strong semantic colors — **green = verified/success**, **amber = urgent**, **red = emergency/red-flag**. Ensure all pass WCAG AA on their backgrounds.
- **Type:** a highly legible sans; large base size (≥16–18px body, larger for primary content); clear hierarchy; avoid light weights for body.
- **Iconography:** simple, universally recognizable; pair icons with text labels (don't rely on icons alone for older/low-literacy users).
- **Layout:** mobile-first, single-column, thumb-reachable primary actions, generous spacing.
- **Tone of imagery/illustration:** if used, inclusive and Filipino-contextual; keep it minimal and functional.

Feel free to run the `design-system`, `ux-copy`, and `accessibility-review` skills to formalize tokens, copy, and an audit.

---

## 5. Screen inventory (design each with all states)

For every screen, provide: default, **loading**, **empty**, **error**, and **success** states where applicable, plus the EN and TL copy.

1. **Welcome / Sign in** — "Sign in with eGovPH (SSO)" as the single primary action; EN/TL toggle; brief trust line ("Your government health rail"). *States: signing-in, error.*
2. **Home / Dashboard** — greeting + who's signed in; big **"Start a visit"** primary; upcoming appointment card (with reference no.); notifications entry. *States: no appointments (empty), loading.*
3. **Symptom intake** — large text field **and** prominent mic/voice button; EN/TL toggle; "you can type or speak, in Tagalog or English." *States: idle, listening/recording, AI thinking, error.*
4. **Triage result / routing** — suggested **department** + **urgency** chip (routine/urgent/**emergency**); a clear note: *"A nurse will confirm this. This is not a diagnosis."*; primary "Continue." **Emergency variant:** full-width red banner — *"Please seek immediate medical help / go to the nearest emergency room now."*
5. **Consent + Identity verification** — consent explanation and explicit accept (National ID eVerify); then **Face Liveness** camera step ("look at the camera"). *States: consent, capturing, verifying, verified ✓, failed/retry.*
6. **Book appointment** — routed specialty pre-selected; confirm slot; shows PGH + reference number on confirm. *States: loading slots, no slots (empty), booking, error.*
7. **Confirmation** — big reference number; prep instructions; "We've texted this to you ✓" (eMessage indicator). 
8. **Records / verified labs** — list of records with **"Verified from another hospital ✓"** badges; detail view showing the verification. *States: empty (no records), loading.*
9. **Doctor summary panel (read-only demo)** — AI-summarized history; label it clearly as staff/demo view. Keep minimal.
10. **Payment / checkout** — itemized bill; **benefit lines labeled "mock / pending real integration"** (PhilHealth / white card / SSS); payable balance; channel choice; pay. *States: loading, processing, settled ✓, error.*
11. **Report an issue** — category picker (wrong routing / billing / access / misconduct / technical); description; **OTP** step; then **case number + status tracker** with escalation note. *States: submitting, OTP, filed ✓, error.*
12. **Notifications / messages** — list of eMessage items (confirmations, reminders, results-ready). *States: empty, loading.*
13. **Global components/overlays** — persistent EN/TL toggle; **consent modal**; **session timeout / auto-logout** warning; global error + empty patterns; toast/inline notifications.

---

## 6. Flow the screens must support

```
Sign in (SSO) → Home → Start a visit → Symptom intake (text/voice, EN/TL)
   → Triage result (dept + urgency; emergency variant short-circuits to "seek help now")
   → Consent + eVerify → Face Liveness → verified ✓
   → Book appointment → Confirmation (+ eMessage sent)
   → [visit] Records / verified labs · Doctor summary
   → Payment (benefits mock-labeled) → settled ✓
   → (if needed) Report an issue → OTP → case number + tracker
```

Continuity note for the design: a session is tied to the person, not the device — an appointment booked earlier reappears on Home when they sign back in. Reflect this with a persistent "upcoming appointment" surface.

---

## 7. Content & tone (critical — coordinate with `ux-copy`)

- **Plain, warm, short.** Address the person directly ("Describe how you feel"). Avoid medical/government jargon.
- **Bilingual:** provide EN and TL for every string. TL should be natural, not literal-translated.
- **Never diagnostic.** Triage copy says *"suggested department,"* *"a nurse will confirm,"* *"this is not a diagnosis."*
- **Emergency copy is direct and calm:** *"This may be urgent. Please go to the nearest emergency room or call for help now."*
- **Mock transparency:** any mocked benefit/integration is visibly labeled (e.g., a small "demo / pending integration" tag) — don't imply live PhilHealth/SSS.
- **Consent copy** is understandable at a glance: what's checked, why, and that they can decline.

---

## 8. Accessibility (must meet — run `accessibility-review`)

- **WCAG 2.1 AA** contrast on all text and semantic colors.
- **Large text**: comfortable base size + a way to scale up; layouts must not break when text grows.
- **Touch targets** ≥ 44×44px (design larger — this scales to kiosk).
- **Voice input** available wherever the user must produce text (esp. symptom intake).
- **Screen-reader**: meaningful labels, focus order, announced state changes (verifying → verified).
- **Simple navigation**: shallow depth, clear back, never trap the user; every screen answers "what do I do next?"
- **Don't rely on color alone** — pair with icon + text (urgency, verified, error).

---

## 9. Explicitly out of scope for this round

- ❌ **Kiosk-specific screens / assisted mode / in-session enrollment** (roadmap — but keep components kiosk-scalable).
- ❌ Full doctor/nurse EMR (only the small read-only summary panel).
- ❌ Real branding for PhilHealth/SSS/hospital systems (these are mock-labeled).
- ❌ Marketing/landing site.

---

## 10. What to deliver back

1. **Screen designs** for §5, each with the required states, in EN and TL.
2. A **reusable component set** (buttons, inputs, mic/voice control, language toggle, consent modal, verification steps, badges, urgency chips, checkout line items, case tracker, empty/error/loading patterns).
3. A **flow map** matching §6.
4. **Design tokens** (color, type, spacing, radii) — ideally as a small system so engineering can map them to the React app.
5. An **accessibility note** confirming AA + the requirements in §8.

*When these come back, engineering (Node/React per [implementation-plan.md](implementation-plan.md)) will implement against the tokens and component set.*
