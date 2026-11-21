# Unreleased — Engine v2 reliability follow-up
- Replace all-pairs element grouping with spatial indexes partitioned by component scale and area, including dense-cell candidate pruning.
- Measure raster neighbourhood coverage before accepting a centreline as a complete component route; supplement uncovered connected branches with contour paths.
- Add regression fixtures for 5,000 clustered components and partial centreline coverage.
- Remove the unused OpenCV.js production payload, keep the injected accelerator hook optional, and align local asset tests with shipped dependencies.
- Remove a duplicate Paper.js worker import.

# 6.0.0 — RASM Engine v2
- Introduce a modular TypeScript engine with strict contracts for raster analysis, connected components, drawable elements, vector-path ownership, route planning, pixel reveal scheduling and diagnostics.
- Replace global longest-stroke selection and bounding-box proximity routing with per-component path ownership; vector paths are split when they cross component ownership.
- Trace an actual raster component outline when it has no centerline or contour route; missing seeds and unscheduled pixels are reported as hard errors.
- Share one element plan and reveal scheduler between the browser and motion Worker. Worker failure uses the same scheduler synchronously; no row-major or top-to-bottom reveal fallback remains.
- Drive the drawing hand and image reveal with the same physical progress clock, including pen-up travel.
- Add RTL/LTR element ordering persisted in .rasm projects.
- Add an in-app scene diagnostics report with downloadable JSON, path ownership, route recovery, unscheduled components and warnings.
- Keep a legacy adapter for .rasm project versions 2 and 3 and the existing editor/audio/timeline/export shell.
- Add TypeScript type checks and dedicated segmentation, ownership, planner, outline trace, scheduler, worker-contract and integration tests.
- Pin OpenCV.js and Paper.js locally with dependency manifests and third-party license notices.

# 5.1.0
- قائمة جانبية للموبايل مع إدارة المشروع والاستيراد والصوت والخصائص والتصدير.
- استخدام لوحة خصائص واحدة عبر المقاسات، وإغلاق القائمة عند تغيير المقاس إلى الكمبيوتر.
- تحسين أحجام اللمس والخطوط والمسافات الآمنة، وتثبيت شريط الأدوات على الموبايل.
- تعطيل فتح القائمة أثناء المعالجة والتصدير.
- زر تنزيل مباشر في نتيجة التصدير وتحسين التباين وحالة المعاينة.

# 5.0.0
- تصدير دقيق لكل إطار، مع دمج الصوت واختيار MP4 أو WebM حسب الدعم.
- محرك تسجيل متوافق مستقل، مع إلغاء نظيف والتوقف عند نقل الصفحة للخلفية.
- حساب حركة القلم بطول المسار، وترتيب الخطوط المتقاربة واختصار الملمس في الوضع الهادئ.
- واجهة عربية جديدة للبداية والخصائص وتوقيت الصوت.
- إصلاح موارد خادم التطوير والمنفذ، وإضافة اختبارات تكامل لخدمة الملفات.
- الحفاظ على ميزات 4.4.0 للمشروعات والعمّال والمخطط الزمني.

## 4.3.1 — Hand speed and motion smoothness
- Add slower hand-speed presets down to 0.1×; slower settings extend the scene duration so the full drawing can finish.
- Interpolate the drawing-hand tip between path samples for smoother movement at playback frame intervals.
- Draw the active path incrementally without allocating a new sliced point array on every frame.
- Preserve and restore the new speed presets in existing `.rasm` projects.
- Add tests for slow-speed duration conversion and fractional hand interpolation.

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


## 4.2.0 — Timeline editing and visible production
- Add a proportional multi-scene timeline with a time ruler, playhead scrubbing, scene selection, zoom and fit controls.
- Drag each scene's right edge to set its final duration directly in seconds; the duration input now uses the same final-time value.
- Keep existing .rasm project fields and legacy duration/speed calculation compatible.
- Show the voice-over track as a waveform lane alongside video scenes.
- Add export progress, elapsed/total time, safe cancellation, and completion/error states.
- Add visible progress for project restore, backup serialization, and audio decoding.
- Add focused tests for time conversion and timeline layout.
