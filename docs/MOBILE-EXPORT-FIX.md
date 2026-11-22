# Mobile export repair

This repair addresses reproduced export-path failures and a mismatch between the default reveal and the outline/color comparison clips. It is not proof that every iPhone, Safari version or project exports successfully.

## Changes

- New scenes default to source-derived outlines followed by original color. Existing saved projects retain their recorded reveal setting. The visible scene control can explicitly apply outlines and source color to all scenes without changing duration or element order.
- Precise export no longer treats the existence of encoder constructors as proof that a codec configuration works. A supported recorder can be used after a codec rejection before the first frame. Cancellation, memory errors and failures after encoding begins do not silently restart a different export.
- The compatible recorder accepts supported generic MP4 declarations as well as explicit AVC/AAC declarations. A finished MP4 must actually contain H.264 video and AAC audio when narration is present. An MP4 extension alone is not evidence of those codecs.
- Audio is resumed synchronously from the export click before asynchronous scene preparation. A blocked resume fails after six seconds with a visible message rather than waiting forever.
- Compatible recording requests a canvas frame where that API exists and anchors frame scheduling to the recording clock instead of adding rendering time to each timer interval. It still depends on device performance and is not deterministic frame-by-frame encoding.
- Completed output is inspected locally for video packets, narration packets when required, actual codec/container and selected dimensions before a download is offered. This does not test perceptual quality or prove that a separate gallery application supports the file.
- The primary download control is a direct file anchor, avoiding a synthetic click on a hidden link after export. Codec-support queries also have a bounded wait.
- Export errors appear in the export panel rather than only below the editor. The user can download a compatibility report with browser/API support, settings and the last export error. It contains no images or audio data and is not uploaded automatically.

## Verified

The full build and existing engine/editor, worker, timeline, migration, project recovery, independent-element and export regressions pass. Offline import, saved-project restoration, first-use H.264 export and optional local inference pass again. A two-version update still waits without reloading an open project.

A browser matrix verifies:

- Precise 1280x720, 24fps VP8/Opus export with narration in desktop Chromium and desktop WebKit.
- Recovery from a rejected precise encoder configuration to a real H.264 1280x720 compatible export without narration.
- Compatible WebM/Opus export when WebCodecs is unavailable, including a synthetic strict click-only audio-resume gate.
- A blocked audio resume stops with a clear message in about six seconds.
- MP4 files with Opus or VP9 are rejected instead of being passed off as H.264/AAC.
- Saved direct-color projects remain direct until the user applies the outline/color control. New imports use outline/color, and applying the control does not change timing.

Generated files were inspected with a media parser and FFprobe. Screenshots and the new default outline/color clip were visually inspected. Desktop WebKit's codec availability is not iPhone hardware availability. Real-device confirmation remains required.

## Limits

The analyzed source remains capped at 960x720. The supplied 1280x720 illustrations are analyzed at 960x540 and may be exported at 1280x720. This was also true of the comparison clips. The repair does not claim higher source detail, perfect automatic semantic masks, native encoders or background export. A compatible recording can still lose smoothness on a busy device. MP4/AAC is not promised on a browser that cannot produce it; use Auto/WebM or a device with suitable encoding support.

## Receiving an update

The app deliberately does not replace code under an open project. Wait for autosave, then fully close old Rasm Home Screen app windows and its Safari tabs before reopening. Do not clear website data to update: that can remove locally saved projects and models. Keep a `.rasm` backup. Existing projects may need the explicit outline/color control to match the new default.
