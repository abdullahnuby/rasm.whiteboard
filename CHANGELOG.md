# Changelog

## 4.0.0 — Image Engine foundation
- Introduced a dedicated image-to-path engine in \`dist/engine.js\`.
- Replaced the basic two-axis pixel-difference scan with blur, Sobel gradients, non-maximum suppression, adaptive double-threshold edge linking, and boundary-safe path tracing.
- Added polyline simplification and controlled resampling to reduce path noise while retaining smooth progressive drawing.
- Moved image analysis into a Web Worker for supported browsers, with a synchronous fallback.
- Increased source-image working resolution to a maximum of 960×720 while preserving aspect ratio.
- Kept the existing scene structure, playback, animation, project settings, and .rasm versions 2/3 compatible.
- Added focused engine tests for blank images, continuous strokes, border handling, and path geometry.

This is the first engine upgrade, not the final photo-segmentation system. Portrait-aware and object-aware drawing modes remain future work.

## 4.0.1 — Stability fixes
- Fixed an infinite loop in `colorSchedule` (fractional path coordinates from the 4.0 resampler); added an integration test.
- A failed restore no longer lets autosave overwrite the saved project; an unreadable record is copied to `recovered-*`.
- Reveal schedule is memoized per scene; first-frame negative time no longer breaks playback/export.
- Autosave stores Blobs in IndexedDB (async PNG encoding); `.rasm` files still embed data URLs; requested persistent storage.
- Export records with a timeslice and flushes the last frame before stopping.
- Transitive path ordering; worker no longer loads `motion.js`; import limits; extra security headers (CSP in report-only mode).


## 4.1.0 — Storage and batch reliability
- Serialize IndexedDB writes and skip stale snapshots so an older asynchronous save cannot overwrite a newer edit.
- Add a project pixel budget in addition to per-file and project-scene limits.
- Process image batches sequentially with progress reporting and cancellation between images.
- Preserve completed scenes when a batch is cancelled.
- Add a recovery browser for recovered IndexedDB snapshots, with open, download, and delete actions.
- Validate imported .rasm scene count, image dimensions, and total working-pixel budget before replacing the active project.
- Add focused tests for serial write queues and image memory-budget calculations.
