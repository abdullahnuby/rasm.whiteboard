# Editor preview audio fix

Branch: fix/editor-preview-audio. Base: 31306e561a2aeb52404c1fc066ff5fbbe55ae2dd.

## Scope

The report was corrected: exported video already has sound; narration cannot be heard while editing. Export encoders are unchanged.

## Findings

- Preview used Web Audio without declaring a playback audio session. On iOS, the default session can be silenced by the ringer switch even when an exported video remains audible. This is a documented platform cause, not yet reproduced on the reporter's physical phone.
- The editor displayed the full narration waveform but limited seeking and playback to the combined image duration. The browser integration test fails on the original code with a 2-second image track and 8-second narration: seek maximum is 2, not 8.
- Clicking the timeline always stopped playback, and image clips jumped to a fixed point rather than the clicked time.

Platform references:
- https://bugs.webkit.org/show_bug.cgi?id=237322 (comment 6, iOS 17+)
- https://developer.mozilla.org/en-US/docs/Web/API/AudioSession

## Changes

- Set audio session to playback when supported, and resume the context directly in the play/seek gesture. Unsupported AudioSession API does not prevent playback. Activation failures are visible.
- Use the audio context clock for the picture playhead; stop cleanly on an audio interruption.
- Include the full narration duration in preview playback and seeking, holding the final picture after images finish. Audio-only preview is available before importing pictures. Export duration is unchanged; use the existing match-duration control before export if needed.
- Seek to the exact clicked point in the ruler, waveform or image clip. Continue playing after a seek only if playback was already running. Pause/restart uses the correct audio offset.
- Keep one buffer source active and disconnect it when stopped. Cancel stale asynchronous preview preparation.

## Verification

`npm run build` passes the full project regression suite, including new preview unit contracts.

`node scripts/preview-browser-test.mjs` uses optional Playwright and local Chrome. It generates its own images and 8-second multi-tone WAV, imports them through the real editor inputs, clicks the real transport/timeline, and verifies:

- Non-silent samples in the real speaker-connected preview graph (RMS about 0.177).
- Playback continues past a 2-second image sequence through the 8-second narration.
- Seeking to 4.25 seconds resumes narration and pictures together.
- Exact image-clip seeking, pause, seek while paused, resume, natural end, restart and audio-only playback.
- No browser page errors.
- Mobile-width screenshot is visually inspected.

The test captures canvas frames and a parallel tap from the speaker-connected preview source to a WebM evidence file. It does not replace the audible speaker destination. ffprobe confirms VP8 video plus Opus audio, and ffmpeg volumedetect confirms non-silent samples. This is editor preview evidence, not a newly exported production project.

## Limitations and release gate

No physical iPhone/silent-switch verification has been performed. The reporter's device and cause remain to be confirmed. No claim of hardware-speaker audibility follows from a desktop graph capture. No merge or production deployment is authorized by this branch. Test on the reporter's iPhone, including silent mode and an imported/restored project, before treating the original symptom as closed.
