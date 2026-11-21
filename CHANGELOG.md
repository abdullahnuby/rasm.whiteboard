# 5.2.1 — Element-based sequencing and directional drawing
- Tighten OpenCV morphological closing to a 3×3 kernel and reduce proximity-based merges so neighbouring components remain separate elements.
- Attach only small, aligned detached marks such as Arabic dots to a nearby larger component.
- Keep every detected element's raster ownership ID aligned with the labels used by the reveal scheduler.
- Remove global longest-stroke filtering; keep all available vector paths and sequence them inside their owning element.
- Start the first path from the selected reading edge and route the remaining paths deterministically within each element.
- Add per-scene RTL/LTR element ordering, persisted in .rasm projects.
- Add tests for element isolation, stable ownership IDs, and directional element and stroke order.

# 5.2.0 — Shape-aware writing engine
- Add a locally bundled OpenCV.js 5.0.0 computer-vision runtime for morphological closing and connected-component segmentation.
- Add Paper.js 0.17.0 vector geometry refinement for centerline and contour path simplification.
- Group disconnected glyph parts and nearby marks into shape-level units, then route strokes inside each shape before advancing to the next.
- Export compact per-pixel shape ownership labels and isolate raster reveal propagation inside the owning shape.
- Give each shape a reveal window that begins when the hand arrives and finishes only at the end of that shape's last stroke; start the next shape after pen-lift travel.
- Add a per-scene sequence control: smart shape grouping or individual stroke sequencing. Preserve the setting in .rasm projects.
- Vendor pinned browser engines into dist/vendor during build and include third-party license notices and asset hashes.

## 5.1.1 — Synchronize image reveal with the hand
- Use one physical travel timeline for pen movement and pixel reveal, including the distance travelled between separate strokes.
- Timestamp reveal seeds by cumulative path distance rather than point count, preventing image/hand drift on unevenly sampled paths.
- Keep stroke-index coordinates only for drawing the active vector path; use normalized physical progress for the original-image reveal.
- Add regression tests for uneven sampling and exact reveal timing along the same route.

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
