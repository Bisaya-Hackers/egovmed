# eGovMed — handoff for Messages + Account screens

**Repo:** `Bisaya-Hackers/egovmed` · **Branch:** `main` · **Commit at handoff:** `68b31ae` · **Deployed staging:** `https://egovmed-frontend.vercel.app` + `https://egovmed-backend.vercel.app`

You're picking up an eGovMed hackathon project. The 12-screen patient flow is built and deployed; two of the five bottom-nav buttons still stub to a toast. Ship the real screens.

## What exists today

| Bottom nav item | Wiring | Behavior |
|---|---|---|
| Home | `A.resetToHome` → `screen: 'home'` | ✅ Real Home screen |
| **Messages** | `A.openMessages` → toast *"No new messages"* | ❌ Stub |
| Center FAB (❤) | `A.go('symptom')` | ✅ Starts a visit |
| Records | `A.goRecords` → `screen: 'records'` | ✅ Real Records screen |
| **Account** | `() => A.toast(c.navAccount)` | ❌ Stub |

The Home screen also has a Messages **quick-service tile** that hits the same stub.

## What the backend already has that you can use

- **`COLLECTIONS.MESSAGES`** in `backend/src/store/index.js` — populated by `appointmentService.book` (booking confirmations) and `sendReminder` (appointment reminders). Each row is:
  ```js
  { id, patientId, kind: 'confirmation' | 'reminder', status: 'sent', channel: 'sms' | 'email' | 'inapp',
    createdAt, provider }  // PII (to/body) intentionally stripped at write time (Codex's audit-hygiene fix)
  ```
  There is currently **no route** to list them — you'll add one.
- **`GET /patients/me`** — returns `publicPatient` DTO from `backend/src/lib/presenters.js`:
  ```js
  { id, firstName, middleName, lastName, suffix, sex, birthDate, email, phone, nationality,
    identityVerified: boolean, benefits: { philhealth: bool, whiteCard: bool, sss: bool } }
  ```
  Already used by the mount effect for session re-validation. `philsysId` and `egovSub` are deliberately not in the DTO.
- **`GET /appointments`** — patient's appointment history (id, specialty, hospital, scheduledFor, queueNumber, status, createdAt). Useful to enrich each message with which appointment it references, if you want.

## What to build

### 1. Backend: `GET /messages`

Owner-scoped list of the authenticated patient's message audit records, newest first. Add to `backend/src/routes/`, wire in `backend/src/routes/index.js` under `/messages`.

- Reads: `store.findAll(COLLECTIONS.MESSAGES, (m) => m.patientId === req.user.sub)`
- Sort by `createdAt` desc
- No PHI: rows are already PII-stripped at write time.
- Rate limit: middleware `rateLimit({ scope: 'messages-list', max: 60, windowMs: 60_000 })` is fine.
- Audit: `auditService.log({ actorId, patientId, action: 'messages.list', resourceType: 'message', requestMeta })`

Optional enhancement: if you want the UI to show *"Your Cardiology appointment reminder for Fri 3:45 PM"*, join in the referenced appointment. The current MESSAGES rows don't store an `appointmentId` link — you'd extend the writes in `appointmentService.js` (`book` and `sendReminder`) to include it, then look it up on read. Small refactor, ~15 lines.

Ship a first version WITHOUT the join if you're time-boxed — kind + createdAt is enough to demo.

### 2. Frontend: Messages screen

Create `frontend/src/screens/Messages.jsx`. Register it in `frontend/src/App.jsx` (`SCREENS` map + `NAV_SCREENS` set).

**Visual pattern:** copy the Records screen (`frontend/src/screens/Records.jsx`). Same structure — `ScreenHeader`, h1, sub, tinted intro card, then a stack of message cards.

**Design intent** (from the DICT `navMessages: 'Messages' / 'Mensahe'`):
- Header: "Messages" / "Mensahe" (from `c.navMessages`)
- Sub: something like *"Confirmations, reminders, and results from eGovMed"* / *"Mga kumpirmasyon, paalala, at resulta mula sa eGovMed"* — add these to `frontend/src/i18n/dict.js` as new keys (e.g. `messagesSub`)
- Each card:
  - Icon (Chat or Bell) in a tinted circle on the left
  - Title: humanize `kind` — `'confirmation'` → "Appointment confirmed", `'reminder'` → "Appointment reminder", `'result_ready'` → "Results ready" (`result_ready` doesn't exist yet; leave the code ready for it)
  - Subtitle: `channel` (SMS · Email · In-app) · relative time (e.g. "2 hours ago" or "Yesterday")
  - Right side: a small chevron
- Empty state: reuse the pattern from Home's "No upcoming appointments" — dashed card, message from `c.messagesEmpty` and `c.messagesEmptySub`

**No detail sheet yet** — just the list. Tapping a card could toast "Message details coming soon" for now, or (better) open the referenced appointment. Skip if time-boxed.

### 3. Frontend: Account screen

Create `frontend/src/screens/Account.jsx`. Register in `App.jsx` `SCREENS` + `NAV_SCREENS`.

**Design intent** (patient-facing, not a settings dump):
- Header: "Account" / "Account" (from `c.navAccount`)
- **Profile card** at the top:
  - Reuse the community avatar photo (`frontend/src/assets/signin-filipino-community.png` — pick a crop, or just show a circular blue-tinted placeholder like Home does)
  - Name: `${firstName} ${lastName}`
  - Contact chip: phone + email
  - "Verified" pill (green, from `c.verifiedBadge`) if `identityVerified === true`
- **Benefits card** — three rows (PhilHealth, White Card, SSS) each with an icon + name + on/off state chip. Use design tokens from `src/styles/index.css`: `--green` for active, `--muted` for inactive.
- **Preferences card** — mirror the util-strip controls but bigger and labeled:
  - Language: EN / TL toggle (calls `A.setLang`)
  - Text size: A / A / A (calls `A.cycleText`; three steps: 17/19/21px)
- **Session card** — one button, "Log out" in red (`--red`), calls `A.logout` which already exists in `App.jsx`
- **About eGovMed** — small footer with app version + a line like *"eGovMed is a government health rail on top of eGovPH. Pilot: Philippine General Hospital."* — hardcoded, no i18n key needed if you want to skip

**Data:** call `api.me()` on mount, show a spinner while loading, fall back to a "Sign in again" prompt if it 401s.

### 4. Rewire the bottom nav + Home service tile

Replace the toast stubs with real navigations.

`frontend/src/components/BottomNav.jsx`:
```jsx
// Messages nav item
onClick={() => A.go('messages')}
active={S.screen === 'messages'}

// Account nav item
onClick={() => A.go('account')}
active={S.screen === 'account'}
```

`frontend/src/screens/Home.jsx` (Messages quick-service tile):
```jsx
onClick={() => A.go('messages')}
```

Delete `A.openMessages` from `App.jsx` if nothing else references it (grep first). The keys stay in DICT because they're used as labels.

### 5. Add both to `NAV_SCREENS` set

In `App.jsx`, the constant `NAV_SCREENS = new Set(['home', 'records'])` gates whether the bottom nav renders on a screen. Add `'messages'` and `'account'` so the nav stays visible on them (users can hop between the 4 primary screens without going through Home).

## Testing / verification

Before opening a PR, verify:

1. **Backend regressions** — `cd backend && npm test` (11 tests, all pass at handoff commit `68b31ae`). Adding a new route shouldn't break any.
2. **Live curl** — after deploying backend:
   ```bash
   BASE=https://egovmed-backend.vercel.app
   TOKEN=$(curl -sS -X POST $BASE/auth/egov/exchange -H 'content-type: application/json' -d '{"exchangeCode":"demo"}' | jq -r .token)
   curl -sS $BASE/messages -H "Authorization: Bearer $TOKEN"
   ```
   Should return `[]` on a fresh patient, or a list once you book an appointment (which triggers a `'confirmation'` message).
3. **Frontend build** — `cd frontend && npm run build` must succeed cleanly.
4. **Live UI walkthrough** on `https://egovmed-frontend.vercel.app`:
   - Sign in
   - Tap **Messages** in the bottom nav → real screen, empty state at first
   - Go back to Home → **Start a visit** → complete the flow to Book → Confirm → this creates a `'confirmation'` message
   - Tap **Messages** again → the confirmation appears
   - Tap **Account** in the bottom nav → real screen with your profile, benefits (PhilHealth ✓), preferences, and logout

## Design consistency notes

- Use design tokens from `frontend/src/styles/index.css` (`--primary`, `--blue-50`, `--ink`, `--muted`, `--line`, `--green`, `--red`, etc.) — never hard-coded hex.
- Card pattern: `<div className="card">` (18px padding, 20px radius, 1px border). Tinted variant: `card tint`.
- Overline labels: `<div className="overline">` (13px uppercase muted).
- Buttons: use `Btn` from `components/ui.jsx` — variants `primary` (default), `secondary` (bordered ghost).
- Icons: import from `components/Icons.jsx` — that's a re-export barrel over `reicon-react` with stable local names. Add new re-exports there if you need icons not yet listed.
- GSAP stagger animations happen automatically for any element with `data-stagger` inside `.screen-wrap`. Sprinkle on cards for a subtle entrance.
- Bilingual strings: add new keys to BOTH `en` and `tl` in `frontend/src/i18n/dict.js`. TL should be natural, not literal.
- The screen container is `<div className="screen">` — 8px top + 22px sides + 28px bottom padding.

## What NOT to break

- Security middleware stack (`secureHeaders`, `jsonComplexity`, `rateLimit`, `requireAuth`, `requireAdmin`).
- Store abstraction (`kvStore.claimStatus` Lua CAS for liveness anti-replay).
- Prod fail-hard checks in `backend/src/config/env.js` `warnIfMisconfigured`.
- Codex's audit-log pattern in `records.routes.js` — mirror it for `messages.routes.js`.
- `ALLOW_MOCK_IN_PRODUCTION=true` is intentional while some integrations are still mock. Don't flip.
- Don't add a `MessageSheet` detail-view yet — the earlier session's Records detail sheet has an outstanding layout bug (see `docs/handoff-live-bugs.md`); replicating that pattern would inherit the bug. Ship the list first, portal the sheet later.

## What "done" looks like

- Two new committed files: `frontend/src/screens/Messages.jsx`, `frontend/src/screens/Account.jsx`
- Backend has `GET /messages` route + route file (owner-scoped, rate-limited, audit-logged, empty-list-safe)
- Bottom nav's Messages + Account items navigate to real screens (active state highlights correctly)
- Home's Messages quick-service tile also navigates
- New DICT keys for both screens' copy, EN + TL
- Deployed to Vercel prod (backend + frontend) and verified end-to-end on the live URLs
- Commits authored as StarRayX <40836712+StarRayX@users.noreply.github.com>, no `Co-Authored-By: Claude` trailer

## Nice-to-haves (skip if time-boxed)

- Link each message to its appointment (`appointmentId` on the message row + a join on read)
- Message detail sheet (portal to `document.body` to avoid the flex-layout bug from the Records sheet — see `handoff-live-bugs.md` §2)
- Account: profile-photo upload (there's no user-generated-content path in the app yet — significant scope; defer)
- Account: language + text-size persistence to `localStorage` (currently reset on refresh)
- A "Preferences → Health data" section that surfaces the doctor summary from `/records/doctor-summary`

Good luck.
