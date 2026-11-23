# Native preview and installed-app update follow-up

Base: 164f640d53cdd9dd26cb1a3fd5c92bfefaa528e6. Branch: fix/preview-native-audio.

The reporter still heard no editor audio after the first release and clarified that he uses an installed home-screen app. His exact browser, iOS version and current cached build are not confirmed. The first release should not be treated as fixing his symptom.

## Findings

The existing service worker serves a versioned cache first and does not skip waiting automatically. An open installed-app window can retain the previous app shell, even while the deployment is current. The existing update notice is inside project management. A fresh production browser test does not prove the installed copy updated.

The previous preview used Web Audio speaker output. It could report a running context without proving audible device output. This follow-up uses the original recording in a visible HTMLAudioElement with native controls. It does not route preview speaker output through an AudioContext. Web Audio remains for decoding/waveform generation and export.

## Changes

- Native media play is invoked directly in the play or seek gesture, before awaiting scene preparation. Pictures follow the media element currentTime. Buffer sources are no longer the preview speaker path.
- Use original imported Blob or restored project data URL. Revoke replaced object URLs, leave unrelated files alone, and keep MP3/M4A/WAV decoding behavior unchanged.
- Visible player, volume controls, playback status and a “Preview audio 2” version label. Rejected play stops picture playback and reports a blocked state instead of silently continuing.
- The native player controls also start/pause/seek synchronized picture preview.
- Visible app update control outside the project menu. Update checks run on foreground return. A waiting worker activates only after explicit click and successful project save; then the requesting window reloads. Busy operations or failed saves block the update. No automatic reload while editing, no data clearing or uninstall.

## Tests

- Full npm run build, including native preview unit contracts, passes.
- Browser integration imports generated pictures and WAV, checks non-silent native-media samples, exact timeline seeks, pause/resume, end/restart, native controls, audio-only preview, rejected play, saved project reload with restored Blob URL, and no page errors.
- Browser worker integration installs version A, stages B while A stays active, applies the explicit saved update, verifies B and restored project title, and verifies that a failed save leaves the next worker waiting.
- Mobile-width screenshots inspected directly.
- Captured native preview file has VP8 960x540 plus Opus 48kHz audio. Decoded mean level -15.1 dB, RMS approximately 0.177.

## Remaining limits

No physical iPhone or installed iOS PWA speaker test is possible here. Do not call the reporter's symptom fixed until he confirms it on his device. This branch is not pushed or deployed pending approval.

A copy still running the old app cannot display a new update control until it loads the new shell. For the first transition, back up the project as .rasm, close every Rasm browser/PWA window from the app switcher, then reopen online. Do not uninstall or clear website data. After the new shell appears, the visible update control removes the need to repeat this manually. Seeing “Preview audio 2” and the native player confirms this branch's shell, not audibility.
