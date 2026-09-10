# Narrated walkthrough: current delivery

The current main viewing file is **eGovMed - Narrated Walkthrough.mp4**, uploaded in place using the same Drive ID: 12WHe0aUB6Z2l7h8wLrZTVcH9TV7NV3vY. It is 61,456,625 bytes. The folder is unchanged:
https://drive.google.com/drive/folders/1ckMYkLrrq21VyNpPbiWxOlk7JSpGRI4n

## Latest user decisions

The teammate recorded narration and added visual fades in a DaVinci Resolve export. The user then explicitly asked to ignore those added visual edits, rebuild using our existing clean master, and let the teammate reapply their video edits afterward. The user ultimately authorized retiming **all** captions to the actual recorded voice, including the opening and ending. This supersedes the earlier instruction to leave some centered captions or estimated timings unchanged.

The result uses the original clean 1920 x 1080, 60fps picture, with 32 speech-timed captions and the friend's existing audio track. The audio is a recorded voice/background mix, not an isolated voice stem. It is copied without re-encoding; do not add the old music or SFX stems on top of it. The earlier SFX-only video in Drive remains an un-narrated editing base, and the old voice guide is retained as a planning reference.

## Caption correction

The former ASS subtitles drew a padded translucent rectangle behind each line. Those rectangles overlapped and produced darker bands. Each new cue has exactly one vector background, with separately positioned text lines. Captions have at most two lines and retain 228 pixels of clearance below the box. Phone-scene captions remain on the left, clear of the phone, keyboard, notifications and payment controls. Opening and implementation captions remain centered.

Timing was based on local word-timed transcription and speech-onset checks. Obvious recognition errors in established terms were corrected, including itchy skin, routing and Bisaya Hackers. The new captions follow the recording's wording, including the final spoken eGovMed introduction. No spoken audio was changed. Caption starts are within 0.12 seconds of the measured first words; ends are within 0.252 seconds of the measured last words. These are alignment measurements, not a claim of zero human-perceived timing error.

## Files and rebuilding

Production root: C:/Users/matth/Videos/eGovMed-Demo

- Current MP4: output/remotion/eGovMed-narrated-caption-fix.mp4.
- Editable captions: output/remotion/eGovMed-narrated-caption-fix.srt and .ass.
- Caption data: output/remotion/narrated-caption-cues.json.
- Preserved audio: output/remotion/eGovMed-recorded-audio.m4a.
- Clean picture: output/remotion/eGovMed-picture-master.mp4.
- Rebuild from those existing assets: `python finish_narrated.py` inside remotion. No transcription, new API calls or full Remotion render is needed to change caption styling.
- Alignment helpers and transcript are in source/prepare_friend_captions.py, source/build_narrated_export.py and output/remotion/friend-transcript.json. Recognition dependencies/model files are task-local and excluded from the editable delivery ZIP.
- Verification: output/remotion/qa/narrated-verification.json and narrated-contact.jpg. Run source/verify_narrated_export.py from the production root to repeat the checks; it compares against the supplied narrated source in Downloads.
- The original supplied video remains unchanged at C:/Users/matth/Downloads/eGovMed - Actual System Walkthrough.mp4.

The new MP4 passes full-file decode and retains all 17,100 clean-picture frames. Its compressed audio stream SHA-256 exactly matches the supplied narrated video: 4e33d79316ea3a9b44cd2c85f02b33cfd71d2f8bf68ef0f3dad1fedb98196c68. The audio peak is -3.75 dBFS. All 32 cues have positive duration, no timing overlap, and one background each. Rendered cue samples were inspected for layout. The prior original-guide PDF and original planning SRT were not rewritten; the new SRT is authoritative for this recorded performance.

## Next step

The teammate can reapply their visual fades and other video edits to this corrected narrated version. If they change clip timing, recheck caption/audio synchronization. No YouTube submission was made. Keep the single existing Drive delivery folder and preserve file IDs when updating. No additional DICT requests or quota resets were used for this caption correction.
