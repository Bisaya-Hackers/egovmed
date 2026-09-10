# Final review and improvement record

## Changes made after critique

The film was rebuilt around the approved Remotion storyboard. The rejected navy floating-card treatment and slogan pills were removed. The current cut uses the eGovMed identity, a credited PGH archive photograph, a logo-to-phone transition, camera moves through captured screens, and animated backend connection paths. The introduction was tightened by six seconds, bringing the film to 3:58.

The phone now has metal edges, a notch, status indicators, side buttons and a home indicator. The camera scale was adjusted to fit the additional hardware. In the typing shot, the camera was moved down so the field and keyboard remain readable. A textarea rollback at a capture boundary was corrected with a clearly labeled typing visualization. The revealed characters, key popups and clicks now use one clock. Analyze is disabled before input, and its tap aligns with the captured loading state.

The appointment notification uses the booking's department, time and reference, without TEST or please-ignore text. The camera reaches the upper phone before the banner appears. Its short original chime starts with the notification. The guide soundtrack has a musical ending, a six-second crossfade into that ending, gentle narration-window ducking and a final fade. Sounds suggesting successful identity verification or completed payment were removed because those actions were not completed.

Actual hosted Face Liveness and eGovPay pages replaced the implied local-success conclusions. Source disclosures were moved to the top so they do not compete with subtitles. The payment close-up prioritizes the amount, transaction state and visible methods while excluding broken decorative provider assets. No transaction information was changed.

The final privacy revision removes the deployment URL from the closing, subtitles, voice guide and publishing notes. The ending was rerendered from the preceding keyframe, retaining the 238-second duration and all 14,280 frames. The guide review also caught a Windows text-decoding artifact in an apostrophe; all caption and guide data now explicitly load as UTF-8.

## Practical limits

Final checks passed for both viewing files: 238 seconds, 1920 x 1080, 60 fps, H.264 video and stereo 48 kHz AAC. Both files decoded fully without errors and have identical compressed video hashes. All 29 SRT cues are within the film and have no overlaps. Peaks are -9.95 dBFS with music and -28.26 dBFS without music. The SFX-only export correlates at 0.999911 with the intended SFX stem at gain 0.7. Reviewed final stills and temporal sequences include typing/key popups, notification entry, hosted pages, the repaired ending boundary and the final fade. The final identity is Bisaya Hackers only.

This is a prototype demonstration with explicit live, hosted and sample scopes. The opening is one credited archive photograph with motion; it is not new hospital documentary footage. The keyboard and notification are illustrative overlays. No biometric verification, payment or SMS delivery is claimed. An application triage issue remains in `APP-ISSUES.md`; it was not fixed or concealed by claiming a successful emergency-routing demonstration.

The final technical verification is recorded in `qa/final-verification.json`. Metadata, decode checks, stills, source timing and audio levels do not replace the team's final listen to its recorded voice on headphones and a phone speaker. The voice guide gives recording windows; the final narration performance may require small subtitle and mix adjustments.

## Best next improvement

Record a calm, natural team voice-over to give the screen holds their intended pace. Let the confirmation, notification and closing moments breathe. Use the supplied SFX-only version if replacing the music, or the separate local picture and audio stems for a fully controlled mix. Keep the implementation and sample-data disclosures and music credit in the narrated submission.
