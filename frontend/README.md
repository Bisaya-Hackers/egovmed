# eGovMed — Frontend (patient mobile web app)

React port of the Claude Design handoff (`eGovMed v2.dc.html`) — the full patient flow: eGovPH MPIN sign-in → home → symptom intake (text/voice) → AI triage → consent + face-liveness → booking → confirmation → payment with benefits → verified records → report-an-issue. Fully **bilingual (EN/TL)**, with an emergency-triage variant and accessibility (text scaling, ≥44px targets, WCAG-AA colors).

## Stack
- **Vite + React 18**
- **[reicon-react](https://reicon.dev)** for icons
- **GSAP** (+ `@gsap/react`) for screen transitions, staggered cards, and success pops
- Design tokens as CSS variables (`src/styles/index.css`), Geist / Geist Mono fonts

## Run

```bash
cp .env.example .env       # optional — defaults work
npm install
npm run dev                # http://localhost:3000
```

The dev server proxies `/api` → the backend (default `http://localhost:4000`, override with `VITE_API_PROXY`). Start the backend separately (`cd ../backend && npm run dev`) to exercise real API calls; **without it the app still runs** — every backend call falls back to the designed demo data, so the whole flow works offline.

## Backend wiring
`src/lib/api.js` calls the eGovMed API for: SSO login, eGovAI triage, eVerify + Face Liveness, appointment booking, eGovPay, records, and eReport. Each call is wrapped so a failure degrades gracefully to the prototype's demo content (the designed timings are preserved for the intended feel).

## Structure
```
src/
  App.jsx              app shell + state machine + screen router + backend actions
  i18n/dict.js         DICT (EN/TL) + data objects — content source of truth (from the design)
  lib/api.js           backend client (Bearer session, graceful fallbacks)
  styles/index.css     design tokens + component styles
  components/          Icons (reicon barrel), ui, PinInput, BottomNav, Overlays, anim (GSAP)
  screens/             the 12 screens
```

## Notes
- Illustration/photo areas are placeholders (`.img-slot`) awaiting official eGovPH art.
- The gear (⚙) opens **demo controls** (emergency toggle, session-timeout, tokens screen, reset) — reviewer shortcuts, not product UI.
- Design source: Claude Design project `686ddf28-…`, file `eGovMed v2.dc.html` (see `docs/design-handoff.md`).
