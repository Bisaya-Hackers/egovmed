# eGovMed video review

This 4:45 revision supersedes the earlier 3:58 cut. It uses Bisaya Hackers as the sole team name, excludes the deployment URL, and leaves narration for the team to record.

## Improvements

The opening now uses six three-second shots built from five verified Philippine General Hospital archive photographs. Each change uses a restrained directional reveal and a quiet matching transition sound. The final photograph matches the approved logo aperture. All overseas stock footage was rejected. PHOTO-CREDITS.md records attribution, archive context and image licenses. The pale background is revealed gradually as the image closes into the actual O cropped from the logo. The remaining letters appear around that same O, eliminating the mismatched-ring crossfade. The previously approved exact-logo transition is retained.

Camera moves were slowed and tied to actions, reading holds and outcomes. Unnecessary movement of the records screen was removed. Screen changes share the phone's position; the implementation diagram moves its phone into the closing position instead of jumping there. The diagram keeps service names visible and distinguishes requests from returned results.

SF Pro Text is used for the iPhone status bar, keyboards and notifications. Typing has varied intervals, word pauses, visible letter popups, numeric keypads, single-field caret focus, stable capitals and synchronized clicks. Input masks preserve captured result evidence and avoid text rolling backward at clip boundaries.

Notifications cover booking, saved records, benefit activation, confirmed payment, report OTP and report filing. No SSO notification was added. SMS-style and in-app-style messages remain distinct. The notification text contains no test/please-ignore prefix. UI effects are custom recreations, not Apple's actual system-sound recordings.

The music is now the lo-fi track Sweet September by Arulo, from Mixkit. Its arrangement uses an interior phrase, crossfades and the original ending. Music and SFX remain separate, and the two viewing versions use identical picture and subtitle streams.

The backend is now a visible blue box, with the phone and API connectors attached to its boundary ports. A single slow request/response example uses directional chevrons on the same curve as its connector, followed by grouped adapter highlights. The phone eases from the report scene into the diagram and returns to the exact closing position. Captions are raised 228 pixels; during phone scenes they occupy the unused left area, clear of keyboard and payment controls. The voice-over script, PDF and SRT wording/timing are locked and verified by file hashes.

## Completed external flows

The user participated in the actual Face Liveness camera step. The footage includes the hosted instructions, camera guide and challenge, the callback and the app's Identity verified screen. The backend returned HTTP 200 with verified true. The fictional eGovPH sandbox account uses Face Liveness; this is not a National ID demographic match.

The payment sequence uses Cash Payments and the gateway's Mark as Paid test control. It includes the visible Transaction Success/PAID state, Go Back to Merchant, and the returned app showing Payment settled for 300 pesos. The backend returned HTTP 200, provider egovpay, status paid and balance 300. No real money was transferred.

The first audit found a broken GrabPay test channel and also found that an overly broad polling guard could interrupt the gateway's essential status refresh. The successful capture uses the user-confirmed cash path and bounded necessary requests. Captures now wait for rendered success text and hold it before returning; fixed sleeps had missed the visible success state in an earlier recording.

## Verification and limits

Both exports passed full-file decoding, 4:45 duration, 1920 x 1080 at 60 fps, H.264/AAC validation, identical video-stream hashes and checks for all typing/notification windows. The SFX-only audio correlates at 0.999921 with the intended stem at gain 0.7. All 30 subtitle cues fit the video without overlaps. Audio peaks are -8.87 dBFS with music and -27.84 dBFS without music.

Narration windows were checked using expanded spoken-word estimates at no more than 130 words per minute, with a pause allowance. The final line ends at 04:42.5 and the picture ends at 04:45.0. The three-page voice guide is intended for one narrator recording cues separately.

Booking, record upload and report examples use local sample data. Keyboard and native-style notification overlays are editorial visualizations, not proof of native push support or SMS delivery. Some provider decorative assets remain imperfect in the actual checkout; transaction data and controls have not been repainted. App findings are recorded separately. Final checks include decoded video, frame/sequence inspection, source timing and audio levels; they are not a claim that a human listened to the eventual team voice mix.
