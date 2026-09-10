# eGovMed manual editing handoff

Continue in the current project, or paste this file into a future conversation yourself. No work has been sent to another conversation.

## Delivery

The final cut runs 3:58, 1920 x 1080, 60 fps. Both viewing versions have English subtitles and SFX. `eGovMed-demo.mp4` has music; `eGovMed-demo-no-music.mp4` removes only music. Neither contains narration. Record the team's voice using the PDF or `VOICEOVER-SCRIPT.md`, then adjust the mix and captions to the actual performance.

The local project root is `C:/Users/matth/Videos/eGovMed-Demo`. Use only `output/remotion` for final deliveries. Earlier exports in `output`, `output/v2`, and `output/motion` are rejected drafts.

## Editing and rebuilding

Extract the editable ZIP, preserve its `eGovMed/remotion`, `eGovMed/assets`, and `eGovMed/output` structure. Install Node.js, Python with NumPy, SciPy and ReportLab, FFmpeg with libass, and Chrome. In `remotion`, run `npm ci`, then `npm run studio`. `node render-film.cjs` produces the clean picture and runs `finish_delivery.py` to make the two delivery versions. The renderer currently points to the standard Windows Chrome path; change `browserExecutable` for another computer. No live API calls occur during rendering.

`src/index.tsx` controls scenes and motion, `src/edit.ts` controls scene/caption timing, and `edit-data.json` is the matching data used by the audio/caption finishing scripts. Keep both timing files in sync. `src/IPhone.tsx` and `src/IPhoneKeyboard.tsx` contain the phone, notification and timed typing. The keyboard, text reveal and clicks share a timing specification. After timing changes, run `python sound_design.py` before rendering. The final audio is mixed by `finish_delivery.py`; its mix is authoritative over the Studio guide preview.

The ZIP contains the prepared source assets and original licensed music. Silent picture, clean viewing export, and WAV stems also remain locally in `output/remotion`. For the supplied raw `SFX.wav`, use gain 0.7 to match the viewing exports; `music-ducked.wav` is already at the intended music level. Do not double the existing mix when adding voice.

## Preserve these decisions

The deployment URL is private. Never put it in the picture, subtitles, voice-over or public publishing notes. The closing uses only the product and team identity.

- Keep the approved blue, red and yellow identity, continuous camera motion and screen-led composition. Do not revert to generic floating cards, slogan pills or slide layouts.
- Retain subtitles, native-looking keyboard/key popups, correct appointment notification text and sparse synchronized SFX. The notification must never say TEST or please ignore.
- The patient types the Tagalog skin/rash concern. Do not substitute the original chest-pain example: the tested service returned routine urgency for it; that application issue remains documented in `APP-ISSUES.md`.
- Live captures include sandbox eGovPH sign-in, an eGov AI response, the hosted Face Liveness entry page, and eGovPay test checkout. No camera verification or payment was completed. Other flows are local samples. The keyboard and notification are editorial visualizations, not proof of native iOS behavior or SMS delivery. Keep these disclosures.
- No application changes were pushed or deployed. The provider checkout remains a test transaction.
- Conservative DICT credit reserve: 43. The later additional allowance of 50 calls remains unused. Do not reset quota or spend beyond explicit authorization.

## Publishing and future work

Record voice, align subtitles to the final performance, listen on headphones and a phone speaker, then export the narrated submission. Keep the Scott Buckley CC BY attribution from `YOUTUBE-DESCRIPTION.txt`. The organizing instructions require a public or unlisted YouTube link; these Drive uploads are editing deliveries, and no YouTube upload has been made.

The reusable skill is installed at `C:/Users/matth/.codex/skills/video-production/SKILL.md`. Invoke `$video-production` in a future task. Its ZIP includes a general planning, research, capture, motion, sound and review process, plus reusable iPhone overlays and helper scripts.
