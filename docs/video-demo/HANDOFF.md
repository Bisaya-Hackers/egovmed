# eGovMed editing handoff

The current cut is 4:45, 1920 x 1080, 60 fps. It has English subtitles and no voice-over. Bisaya Hackers is the only team name. The deployment URL is private and must remain absent from the picture, captions, voice script and publishing notes.

The friend-facing Drive folder contains only the music-and-SFX video, the SFX-only video and the voice guide. Source material, subtitle files, credits and internal notes are stored separately. No work has been sent to another conversation; this is a manual handoff file.

## Files and editing

The production workspace is `C:/Users/matth/Videos/eGovMed-Demo`. Final outputs are under `output/remotion`. Earlier files in `output`, `output/v2` and `output/motion` are rejected drafts. The previous 3:58 cut is superseded.

The authoritative timeline, captions, typing tracks and notification events are in `remotion/edit-data.json`, mirrored in `remotion/src/edit.ts`. The main composition is `src/index.tsx`. Dedicated modules are `Opening.tsx`, `IPhone.tsx`, `IPhoneInput.tsx`, `NativeNotifications.tsx` and `Architecture.tsx`. Do not rerun one-off patch scripts blindly; they may duplicate edits or restore older timings.

Install Node.js, Python with NumPy, SciPy, Pillow and ReportLab, FFmpeg with libass, and Chrome. Run `npm ci` and `npm run studio` inside `remotion`. `node render-film.cjs` renders the silent picture and runs `finish_delivery.py`, which delegates to `finish_delivery_revision.py`. `python sound_design.py` delegates to the revised sound builder. Rendering itself makes no live API calls.

The script currently uses the standard Windows Chrome executable path; adapt it on another computer. Obtain SF Pro fonts separately from Apple's official font resources under their terms and place SF-Pro-Text-Regular.otf and SF-Pro-Text-Semibold.otf in public. Apple font binaries are not included in the reusable skill or shareable source package.

Use the silent picture master and audio stems for a controlled voice mix. The supplied music stem is already volume-automated; use gain 0.7 for the raw SFX.wav stem to match the viewing exports. If adding voice to a viewing MP4, do not add that file's existing music or SFX again. Adjust captions if the final performance differs from the script.

## Latest delivery and locked narration

Continue using only the existing friend-facing Drive folder and replace its two videos in place. Do not create or move to new delivery folders. Keep the existing voice-over PDF unchanged. This revision keeps the script, 30 cue windows and SRT text byte-identical. The reusable skill contains the new graph and player-control checks.

`render-corrections.cjs` renders changed picture regions and splices them at verified source keyframes. It invokes `finish_delivery.py --preserve-guide` to retain the PDF. Full delivery verification includes locked narration hashes. Do not blindly rerun this one-off correction script on arbitrary future edits without revalidating its source splice points.

## Preserve the accepted direction

Keep the exact-logo O transition, gradual background reveal, stable phone framing, deliberate camera moves and readable holds. Use natural typing timings and matching SFX, not fast uniform intervals. Keep all six relevant notification moments outside SSO. The music is lo-fi; do not restore the rejected cinematic track.

The complete Face Liveness and cash-test payment recordings are the evidence for those flows. Preserve the rendered outcomes and returns. Do not replace them with entry pages or make local samples appear to be completed government transactions. The cash gateway's Mark as Paid control is explicitly a sandbox test, and Face Liveness on the fictional SSO account is not a National ID demographic match.

The original chest-pain example was excluded because it was routed as routine. Keep the demonstrated skin/rash query and the nurse-confirmation disclaimer. See APP-ISSUES.md for application findings. This task did not deploy application fixes.

## Budget and next step

The conservative local API reserve is 169. The latest allowance began at 93 and permits up to 100 additional calls, for a reserve ceiling of 193. This includes conservative estimates and provider UI requests; it is not a portal-confirmed charge. No more calls are needed for this edit, and no quota reset was performed.

Record the team narration using the timed guide, align it to the picture, and check the mix on headphones and a phone speaker. The organizing instructions require a public or unlisted YouTube link; no YouTube upload has been made. Keep music licensing information with publication notes.

The reusable skill is installed at `C:/Users/matth/.codex/skills/video-production/SKILL.md`; invoke `$video-production` in a future task. It includes planning, reference study, capture, motion, audio, narration timing, review and reusable phone overlays.

## Capture evidence and exact restore paths

- Final cash capture: captures/cash-final/page@a8ca193e28568bbb3d37ad5f14336b5a.webm. Prepared footage: remotion/public/cash-final.mp4. Timing: source/cash-final-markers.json. Evidence: output/remotion/qa/cash-final-source.json. Reference 4H57FWJAZX. Backend HTTP 200, provider egovpay, status paid, settled balance 300. The final recording waits for rendered Transaction Success and PAID, holds the result, clicks Go Back to Merchant and returns to the settled app.
- Complete liveness capture: captures/complete-liveness/page@900d897c221e2723d6c6110b81d08cfa.webm. Prepared footage: remotion/public/complete-liveness.mp4. Evidence: source/complete-liveness-evidence.json, HTTP 200 verified true. The user participated at their camera. Preserve the challenge, callback and visible verified result.
- Sample flow capture: captures/expanded-local/page@eb9a3c60c0ebc6a9c99440fce416d4d0.webm, prepared as remotion/public/expanded-local.mp4, with source/expanded-local-markers.json. Booking PGH-7688-JT, Dermatology Tomorrow 3:30 PM; sample report OTP 864947, case EGM-2026-189722. No actual government complaint was filed.
- API reserve ledger: source/credit-ledger.json. Do not reset quota or initiate fresh calls for an edit that can use these recordings. The last allowance was 100 additional calls starting at reserve 93; reserve 169 is a conservative estimate, not a portal-confirmed charge.
- Final verification: output/remotion/qa/final-verification.json. Narration locks: output/remotion/qa/locked-narration.json. Final contact sheet and transition sequences are in that same qa directory.
- Current entry point: remotion/src/index.tsx. Motion modules: Opening.tsx, Architecture.tsx, IPhone.tsx, IPhoneInput.tsx and NativeNotifications.tsx. Timeline and wording: remotion/edit-data.json plus src/edit.ts.
- Caption layout: finish_delivery_revision.py defines centered Default and left-side App ASS styles, both with MarginV 228. SRT contents and guide timing remain unchanged. For finishing from the current silent master, run python finish_delivery.py --preserve-guide.
- Final clean-box regional patch: render-clean-backend.cjs and finish_backend_patch.py. It rendered global frames 14380–17099, preserved the clean master before the verified IDR at 14380, and preserved the viewing export before its verified IDR at 14500. This was a one-off optimization for the current source; verify keyframes again before reusing those exact cut points on another master.
- Full rebuild: node render-film.cjs, followed by any required finishing with --preserve-guide if narration is still locked. Regenerating a guide PDF can change bytes even with the same text; keep the existing guide when requested.
- Source packaging: python package_delivery.py. It includes the current source, prepared media, credits and verification. Apple SF Pro binaries are excluded. The general skill is installed in C:/Users/matth/.codex/skills/video-production and packaged locally as video-production-skill.zip.
- Online application repo for Markdown notes: C:/Users/matth/egovmed-public, origin https://github.com/M4tyu633/egovmed, branch main, docs/video-demo. C:/Users/matth/egovmed is a different checkout; leave its unrelated changes alone.

The original problem storyboard and rejected drafts are historical context only. Do not restore the old music, generic overseas stock, mismatched logo O, disconnected backend arrows, decorative backend strip, fast typing, missing liveness outcome or incomplete payment redirect. No BH Studios branding or deployment URL belongs in the video. The team name is Bisaya Hackers.
