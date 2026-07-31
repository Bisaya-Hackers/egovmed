# eReport integration — go-live notes

Everything here was verified against the staging host on **2026-07-30** with the credentials in
`backend/.env` (never committed). Where the number below disagrees with
`apidocumentation/eReport-API.md`, the live API is the source of truth — the bundled doc is a
snapshot of the Postman collection and is already out of date in places.

## What we verified live

| Check | Result |
| --- | --- |
| `POST /api/integration/token` | 200, `{ access_token, expires_at }`. Token is a bare UUID; `expires_at` was ~2 days out, not the ~1 hour the adapter used to assume. |
| `GET /datasets/report_types` | 200, **12** codes (the bundled doc says 9). None are health-related. |
| `GET /datasets/regions` / `provinces` / `municipalities` / `barangays` | 200. `province_code` / `municipality_code` filters work; `per_page` is ignored (unfiltered `barangays` returns all 42,036 rows). |
| `POST /api/integration/submit_complaint` | 200, `{ code, message, case_number }` at the **top level** (no `data` envelope). Case number `PFM-MMDDYY-####`. |
| `GET /api/integration/reports/:case_number` | Not exercised — requires a token we cannot obtain (see "The view-token problem"). |

Report type codes, in the order returned:
`scam`, `gas_station_concerns`, `red_tape`, `child_abuse`, `women_abuse`, `OFW_APP`,
`overpricing`, `fire`, `Senior Citizen`, `accident`, `crime`, `illegal_dumping`.

There is **no** `health_service` type. Earlier handoff notes guessed one existed; it does not.
`red_tape` ("Red Tape") is the closest available fit for a complaint about service at a public
hospital, and is what we file under. **Open question for the eGov team: is `red_tape` the right
bucket for health-facility complaints, or should a health type be added?**

## Location codes for PGH

PGH is at Taft Avenue, Ermita, Manila. The trap in this dataset is that **Manila's districts are
modelled as "municipalities", not as barangays.** `province_code=133900000` (CITY OF MANILA)
returns 15 municipality rows, and they are districts:

```
133900000 CITY OF MANILA      133901000 TONDO I / II      133902000 BINONDO
133903000 QUIAPO              133904000 SAN NICOLAS       133905000 SANTA CRUZ
133906000 SAMPALOC            133907000 SAN MIGUEL        133908000 ERMITA
133909000 INTRAMUROS          133910000 MALATE            133911000 PACO
133912000 PANDACAN            133913000 PORT AREA         133914000 SANTA ANA
```

So Ermita **is** in the dataset, as `133908000`. (Querying barangays under `133901000` and finding
897 rows named "Barangay N" is what made it look absent — that is Tondo, not all of Manila.)

`GET /datasets/barangays?municipality_code=133908000` returns 13 rows, all `zip_code: null`:

```
133908001 Barangay 659    133908002 Barangay 659-A  133908003 Barangay 660
133908004 Barangay 660-A  133908005 Barangay 661    133908008 Barangay 666
133908009 Barangay 667    133908010 Barangay 668    133908011 Barangay 669
133908012 Barangay 670    133908013 Barangay 663    133908014 Barangay 663-A
133908015 Barangay 664
```

### What we chose, and how sure we are

| Field | Value | Confidence |
| --- | --- | --- |
| `region_code` | `130000000` — NATIONAL CAPITAL REGION (NCR) | Certain |
| `province_code` | `133900000` — CITY OF MANILA | Certain |
| `municipality_code` | `133908000` — ERMITA | Certain. Confirmed by name in the live dataset. |
| `barangay_code` | `133908012` — Barangay 670 | **Approximate.** See below. |

The barangay is the one value we cannot fully stand behind. The dataset carries no streets,
landmarks or ZIP codes, so it cannot be resolved from the API alone, and public geocoders
disagree: address strings for PGH commonly render as "Taft Avenue Ermita, Brgy 670, Manila", but
at least one OSM-derived source places the hospital in Barangay 669. Both barangays exist in the
dataset (`133908011` = 669, `133908012` = 670). PGH is a ~10-hectare campus spanning the block
between Padre Faura and Pedro Gil, so it plausibly straddles both. We picked **670** because it is
the value that appears in the majority of published PGH addresses.

**Question the eGov team still needs to answer: which barangay code does eReport expect for the
PGH campus, 133908011 (669) or 133908012 (670)?** Getting it wrong misroutes the complaint to the
wrong barangay desk; it does not break submission (staging accepted 670 without complaint).

## The view-token problem

`GET /api/integration/reports/:case_number` needs a `report_view_token`, which is minted like this:

```
POST /verify/request  { email }        → eReport emails a 6-digit OTP to that address
POST /verify/confirm  { email, otp }   → { report_view_token, expires_at }
```

The token is therefore **per-complainant and short-lived**. A single env-wide
`EREPORT_VIEW_TOKEN` can only ever read the cases of the one mailbox whose OTP minted it, and only
until it expires. It cannot look up an arbitrary patient's case, which is exactly what the
tracking screen needed it for.

### Decision (MVP)

We removed the status read-back rather than fake it.

- `EREPORT_VIEW_TOKEN` is gone from config, `.env.example` and the adapter. It promised a
  capability that could not exist.
- `eReport.getStatus()` is deleted. `reportService.getByCase()` no longer merges an upstream status.
- The 4-step "Received → Under review → Assigned → Resolved" tracker is gone from the Report
  screen. eGovMed never learned any of those transitions, so every step past the first was
  invented.
- What the patient sees instead: the case number, the date filed, eGovMed's own state
  (**Filed**, or **Escalated** once our 48-hour sweep fires — both of which we genuinely know),
  and a note saying updates come from eReport by email and the case number is what to use there.

### To restore live status later

eGovMed would have to relay eReport's OTP: collect the patient's emailed code in our UI, call
`verify/confirm` on their behalf, and cache the short-lived `report_view_token` against their
session. That is a feature with its own consent and UX questions, not a config value.

Note also that the bundled doc and the adapter disagree on the auth header for the reports
endpoints (`X-EReport-View-Token` vs `Authorization: Bearer`). We could not settle it empirically
without a token. **Worth confirming with the eGov team before anyone builds the OTP relay.**

## Env vars to set for go-live

```
EREPORT_MODE=live
EREPORT_BASE_URL=https://stg-ereport-ws.oueg.info    # staging; swap for the prod host at cutover
EREPORT_ACCESS_CODE=<the access code already stored in Vercel>
EREPORT_TYPE=red_tape
EREPORT_REGION_CODE=130000000
EREPORT_PROVINCE_CODE=133900000
EREPORT_MUNICIPALITY_CODE=133908000
EREPORT_BARANGAY_CODE=133908012
EREPORT_ESCALATE_AFTER_HOURS=48
```

`EREPORT_VIEW_TOKEN` should be **deleted** from Vercel — it is no longer read.

`warnIfMisconfigured()` fails the boot if `EREPORT_MODE=live` and any of base URL, access code, or
the four location codes are empty, so a half-filled set cannot ship silently.

## Filing is gated on our own SMS OTP

A complaint carries the complainant's name and phone into a government queue, so filing is gated
on a code we text to the number on the patient's record. This is eGovMed's own check, unrelated to
eReport's email OTP for case lookup (above).

- `POST /reports/otp` mints a challenge and sends the code over eMessage. **The server chooses the
  destination — the patient's `phone` — and the request body is empty.** A client-supplied number
  would turn "prove you control this phone" into "type a number and read your own code back".
- `POST /reports` takes `challengeId` + `code`, verifies and consumes them, and only then calls
  eReport. A wrong, expired, reused or over-capped code files nothing.
- Only `sha256("otp:<challengeId>:<code>")` is stored. TTL 5 minutes, one use, 5 attempts before
  the challenge is retired. The claim goes through `store.claimStatus` (the same Redis
  compare-and-set the liveness flow uses) so concurrent attempts cannot share an attempt budget.
- **No phone on file → no filing.** `POST /reports/otp` returns 400 telling the patient to add a
  mobile number in Account. There is no email fallback: the live eMessage adapter only implements
  SMS push, and filing unverified would defeat the point of the check.
- **Mock mode returns the code** (`mockCode`) because no SMS leaves the process when
  `EMESSAGE_MODE=mock`, which is the only way the flow is completable offline and on staging. The
  field is gated on the eMessage adapter's own mode, never on `NODE_ENV`, so a live-credentialed
  deployment never emits it.

## Adapter behaviour worth knowing

- **Mobile format.** eReport wants `639XXXXXXXXX`. Patient phones are stored as `+639170000000`
  and typed as `09171234567`; the adapter now normalizes both. It previously stripped a leading
  `+` only, so hand-typed numbers went out as `09171234567`.
- **Email fallback.** `contact` is one free-text field that may hold a phone or an email. It is
  only used as `complainant_email` when it actually looks like an email — otherwise a phone number
  would land in the field eReport uses to deliver its OTP.
- **Token cache** honours the server's `expires_at` (minus 60s of skew) instead of a hardcoded
  50 minutes, falling back to 50 minutes if the field is missing.
- **Missing case number** raises a 502 instead of storing a report whose case number is
  `undefined`, which would leave the patient with nothing to track and no error explaining why.
