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

The dev server listens on all local interfaces and proxies `/api` → the backend (default `http://localhost:4000`, override with `VITE_API_PROXY`). Start the backend separately (`cd ../backend && npm run dev`). From another device on the same Wi-Fi, open `http://<PC-LAN-IP>:3000`.

## Backend wiring
`src/lib/api.js` calls the eGovMed API for SSO login, eGovAI triage, eVerify + Face Liveness, appointment booking, eGovPay, records, and eReport. Authentication, identity, and payment flows fail visibly and never advance on a timer. The live SSO, liveness, and payment flows preserve state across same-tab provider redirects using `sessionStorage` and confirm results with the backend.

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
- Patient-facing illustrations live in `src/assets/`; GCash and Maya marks come from their current App Store artwork and should be replaced with licensed partner assets before production if required by the partnership agreement.
- The gear (⚙) opens **demo controls** (emergency toggle, session-timeout, tokens screen, reset) — reviewer shortcuts, not product UI.
- Design source: Claude Design project `686ddf28-…`, file `eGovMed v2.dc.html` (see `docs/design-handoff.md`).
