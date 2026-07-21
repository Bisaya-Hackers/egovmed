# eGovMed

**The smart front door to public healthcare** — a phone/web app that runs AI triage, verified identity, portable medical records, and payments on top of the eGov API stack. Pilot: **Philippine General Hospital (PGH)**.

> One login, one medical record, one payment — so patients at PGH stop re-entering data, stop repeating labs, and stop lining up to pay.

**Team:** Bisaya-Hackers (UP Manila) · **Event:** eGov Hackathon

---

## Scope (decided this round)

**Build the app only.** A phone/web client on a **client-agnostic backend**.

- ✅ **In scope:** SSO login, AI symptom triage (English/Filipino), identity verification + face liveness, appointment booking + reminders, verified-record badge, payments with benefits (mocked), issue reporting.
- 🛣️ **Roadmap — do NOT build this round:** the assisted **kiosk** client for walk-in patients with no phone / low digital literacy (in-session enrollment, assisted mode). The backend stays client-agnostic so the kiosk plugs in later as a second client.

This resolves a scope conflict between the two handoff docs — see [Decisions & doc cleanup](#decisions--doc-cleanup).

---

## The 8 eGov APIs (all used — no DBM Compass)

| API | Role |
|---|---|
| **eGovPH SSO** | Login → session; auto-fill the patient profile |
| **eGovAI** | Symptom triage + Tagalog translation → `{specialty, urgency, red_flags}`; summarize history for doctors |
| **National ID eVerify** | Verify against PhilSys with consent; gate record access |
| **Face Liveness** | Confirm a live person during ID capture (anti-abuse) |
| **eMessage** | Confirmations, reminders, "results ready" via SMS / email / in-app |
| **eGovChain** | Anchor record hashes/pointers on Besu (tamper-evident, cross-hospital trust) |
| **eGovPay** | Settle the bill via the unified gateway; multi-channel |
| **eReport** | File/track issues by case number; escalate; feed recurring errors back to triage |

---

## Non-negotiable build rules

1. **`.env` holds all secrets and is gitignored** — never commit it. Copy `.env.example` → `.env`.
2. **Triage is decision support, not diagnosis.** Output always includes an urgency / red-flag; a human confirms. Urgent patterns → clear "seek immediate human medical assessment" instruction.
3. **eGovChain stores only hashes / pointers / consent / timestamps.** Raw PHI stays encrypted off-chain (Data Privacy Act 2012).
4. **Benefits (PhilHealth / white card / SSS) are mocked / clearly-labeled future integrations.** Do not claim those APIs exist. Same for hospital systems and national medical repositories.
5. **No passport verification claims** — National ID eVerify is the authoritative identity API.
6. **Identity is the anchor** — records, appointments, and payments all key off the eGov / PhilSys ID.

---

## Getting started

```bash
git clone git@github.com:Bisaya-Hackers/egovmed.git
cd egovmed
cd backend
copy .env.example .env   # fill in API keys — .env is gitignored
npm install
npm run dev

# in a second terminal
cd ..\frontend
npm install
npm run dev
```

Open `http://localhost:3000` on the PC. For a phone on the same Wi-Fi, open
`http://<PC-LAN-IP>:3000` (for example `http://192.168.1.9:3000`). Vite listens on
all local interfaces and proxies `/api` to the backend, so the phone only needs port 3000.

If Windows marks Wi-Fi as Public, run this once from **PowerShell as Administrator**:

```powershell
New-NetFirewallRule -DisplayName 'eGovMed local phone testing' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -RemoteAddress LocalSubnet -Profile Public,Private
```

Remove the development rule when finished with:

```powershell
Remove-NetFirewallRule -DisplayName 'eGovMed local phone testing'
```

### Real provider callbacks

Same-Wi-Fi HTTP is enough for the application and mock adapters, but it is not enough for
eGovPH SSO, hosted Face Liveness, or eGovPay. Those providers require a public HTTPS origin.
Set `APP_URL` to the public frontend origin, `API_PUBLIC_URL` to the public backend origin,
register the documented callback URLs with each provider, and set only the corresponding
`*_MODE=live` after its credentials and base URL are present. Do not set the global mode to
`live` while an integration is incomplete.

Stack: React/Vite frontend + Node/Express backend; eGovChain anchoring via JSON-RPC (Hyperledger Besu).

---

## Decisions & doc cleanup

Resolved from the handoff docs ([egovmed_handoff.md](egovmed_handoff.md), [egovmed_dev_handoff.md](egovmed_dev_handoff.md)):

- **Kiosk = roadmap, not this round.** App-first this hackathon.
- **DBM Compass excluded.** The project handoff still lists it as an optional 9th API ([egovmed_handoff.md:80](egovmed_handoff.md)) — update the pitch to say **8 APIs**.
- **Benefits language is aspirational.** The docs describe PhilHealth / SSS auto-apply as if live; the build and pitch must label these as **mocks / future integrations**.

---

## Docs

- [egovmed_handoff.md](egovmed_handoff.md) — full project handoff
- [egovmed_dev_handoff.md](egovmed_dev_handoff.md) — developer TL;DR
