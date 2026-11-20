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
