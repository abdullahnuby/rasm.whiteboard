# RASM Studio 5.2.4 QA Report

## Screenshot-derived root cause
The iPhone screenshots at 00:04, 00:11, and 00:23 show horizontal bands of image pixels appearing across several unrelated shapes at once. Source inspection identified two explicit paths that bypassed element ordering:
1. While the motion Worker had not returned a schedule, the preview clipped the original image with a top-to-bottom rectangle (image height multiplied by scene progress).
2. If the Worker was unavailable, failed, or exceeded the 15-second preparation deadline, the fallback schedule revealed pixels in global row-major order.

These paths reproduce the band-by-band pattern in the screenshots even when element-aware scheduling exists.

## Fixes in 5.2.4
- Removed the top-to-bottom rectangle fallback from original-image rendering.
- Replaced all row-major fallback schedules with a synchronous call to the same buildColorSchedule(scene) used by the Worker. Fallback therefore keeps shape IDs, per-element windows, pen-lift travel and reveal ordering.
- The play control now waits for every original-image scene to have a completed element-aware schedule before starting playback. The hand and preview clock do not begin while the schedule is still being prepared.
- Export retains its existing prepareColorSchedule gate and now receives the same element-aware fallback on Worker failure.

## Regression tests
- A multi-element synthetic scene is scheduled with the synchronous fallback and asserts that every pixel of element 1 is revealed before any pixel in element 2.
- Static build checks prohibit the old top-to-bottom preview crop and require playback to await prepareColorSchedule.
- Existing element grouping, diagonal connectivity, centerline/contour/synthetic route fallback, Worker timing, reliability, timeline, export and resource tests remain in the build.

## Validation boundary
The Worker remains the preferred asynchronous fast path. The main-thread rebuild is only used if the Worker cannot deliver a schedule within the preparation window. It may take longer on lower-powered phones, but it will not deliberately revert to a row-major wipe.
The user's exact project file is still needed to validate its image-specific segmentation and stroke ownership.
