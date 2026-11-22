# Independent-element checkpoint, 22 November 2026

This is a working browser/source checkpoint, not a finished Windows or Android release. Windows, Android and browser are the targets. Processing stays on the device. The native wrappers, native encoders, installers and device acceptance tests are not delivered here.

## Implemented

- Typed source-preserving element document, separate from the scene's immutable source analysis. Accepted masks retain their original canvas coordinates. Ownership is per foreground pixel, not a rectangular crop.
- Stable element IDs, name and relative duration share, reorder, merge, brush add/remove, brush split, undo and redo. Splitting and merging preserve the combined time share. Undo branches do not reuse discarded IDs.
- A real review dialog with source overlay, proposals, explicit acceptance and an unassigned-pixels count. Overlapping proposals use first-accepted ownership. Brush addition can intentionally transfer ownership.
- All unassigned source foreground remains in a final drawable remainder. Removing an element returns its pixels to that remainder. Removing all accepted elements can restore the original automatic plan.
- Accepted order drives the actual drawing worker. Element chips show the resulting drawing-time windows. Relative time shares divide the scene's drawing duration; these are not arbitrary absolute start/end keyframes or movable object positions.
- Shared deterministic preview/export renderer, including the element time mapping. Authored elements use 65,536 reveal bins so a short path stretched over time does not inherit a coarse 256-step reveal.
- IndexedDB metadata and content-addressed ownership blobs commit atomically with the rest of the project. Project-file version 4 preserves element ownership. Versions 2 and 3 still load. A project without element data is still saved as version 3. Older editors should reject version 4 rather than silently drop the new data.
- Optional MobileSAM proposals run in a cancellable browser worker using local ONNX Runtime Web WASM. There is no hosted inference service and no image upload. The worker is terminated on cancellation; results are not silently accepted.
- Local mask bundles can be imported from the Python experiment. RLE dimensions and a SHA-256 of the original source file are checked before import. This protects against applying a mask to a different image.
- A temporary legacy DOM/session adapter remains. This is not a claim that the entire old shell has been replaced.

## Run

Requires Node.js 20+:

```sh
npm ci
npm run build
npm run dev
```

Open `http://localhost:3000`. Serve over localhost or HTTPS. Opening `dist/index.html` directly as a file does not support the worker/module flow. A built `dist/` can be served as a static website. The browser shell now has offline caching and an installable manifest. See PWA-OFFLINE.md for preparation, limits and verified behavior. This is not an APK or EXE.

### Optional local proposal models

The core review, brush controls, ink-component fallback and mask import work without AI models. For the optional proposal worker:

```sh
python experiments/element-segmentation/download_models.py
```

This explicit one-time download verifies two pinned model files in `experiments/element-segmentation/models/`. In the editor open the element review dialog, choose the optional-model installation button, and select both ONNX files. They are verified again and stored in this browser's IndexedDB. The files are not sent to a server. Clearing browser site data removes this model cache. Automatic in-app model downloading is not implemented yet.

Weights are not included in the source or browser checkpoint. Model redistribution terms need review before an installer bundles them. ONNX Runtime's license and third-party notices are included under `licenses/` and copied to the browser build.

For external mask proposals:

```sh
python -m pip install -r experiments/element-segmentation/requirements.txt
python experiments/element-segmentation/propose_elements.py input.jpg --output results
```

Import `results/element-masks.rasm.json` against the same original image file. This remains a proposal/review workflow, not a semantic detector that is allowed to silently approve its own masks.

## Verification

- Full build: TypeScript, 19 engine tests, 36 editor tests, worker contracts and the existing motion, scheduling, reliability, timeline, export and serving checks pass.
- Real browser, supplied tree illustration: import 33 local Python proposals; accept tree and flower; rename/reorder; change time share; apply actual worker routes; check the early frame reveals only the scheduled first element; retain all 139,648 foreground pixels; inspect the element timeline.
- Actual canvas brush split and undo, merge/undo, draft cancel, autosave/reload, version-4 .rasm backup/reload and clear-all back to original analysis pass. Stable IDs, order and timing survive reload.
- The authored schedule has 65,537 cumulative entries and zero unscheduled source pixels. Coverage is with respect to the editor's analyzed source canvas, which is limited to 960x720, not a claim of full-resolution semantic extraction.
- Browser-local inference, Chrome 157 on this test desktop: 26 tree-image proposals in 26.2 to 27.5 seconds. Cancellation/restart and accepting a result into the real timeline pass. No off-origin network requests or page exceptions occurred during inference.
- Browser regressions still pass: sample planning/playback, sorted image import, repaint after reload, duplicate/rename/delete/undo, valid/invalid project restore, backup cleanup, WebM with narration, H.264 MP4 without narration, explicit unsupported AAC handling, and 320/390px layouts.
- Actual screenshots of desktop review, mobile review, proposal results and timeline were inspected. A cramped button row was corrected and rechecked.

## Size and performance, not release claims

- Optional model files: 44,658,416 bytes combined.
- Locally vendored optional ONNX Runtime files: about 12 MB uncompressed. They are loaded only when the proposal worker starts, but they count toward a packaged app's size if included.
- Browser aggregate process RSS was about 1.2 GB before inference and 1.5 GB peak in the first run. A cancellation/restart run reached roughly 1.76 GB aggregate RSS. These include browser processes, editor and inference, are not isolated model-memory measurements, and are not Android measurements.
- No APK/EXE installed-size, mobile memory, battery or device-latency claim is established. Excluding optional weights from an APK would not justify calling the complete installed product smaller.

## Remaining quality gap

The masks are imperfect. Some plants are useful proposals; duplicates, missing stems, split objects and incomplete Arabic dots/marks remain. The UI makes those limitations explicit and permits repair. Never regenerate Quranic text, replace the source text with OCR, or infer that a model score measures correctness.

A source-rendered visual comparison with `daslearning-org/image-to-animation-offline`, commit `0165cc5a26addcad3843966c0f1b4d68fc94b7aa`, was made on the same tree illustration at an equal 11.96-second duration. Its outline-first pass makes the drawing readable earlier. The pre-quality-change original-color reveal remained fragmented until late; the follow-up below improves it. We have not matched or beaten that visible output yet. Lower sampled hand displacement is not proof of better animation.

## Rendering follow-up in this checkpoint

The near-pen reveal change is now implemented. A pixel's geodesic distance from its hand-path seed consumes physical pen-travel time rather than most of the remaining element duration. This reduces the late patchy fill without changing ownership or source pixels.

A new experimental selector offers direct color or outlines followed by original color. Outlines are derived from the source and restricted to the same foreground mask, not regenerated text. The drawing duration is split 60/40 between outline and color, with a short eased pen-up return. Accepted elements complete both passes before the next accepted element begins. Automatic scenes use a whole-scene outline/color pass. Other drawing styles retain their existing behavior.

The shared deterministic renderer and export snapshot contain the reveal setting. It is persisted in IndexedDB and version-4 project files. Final frames exactly restore the original analyzed source pixels, not the derived outline. Tests cover source-derived masks, deterministic backwards scrubbing, pen-up transfer bounds, missing-resource errors and final-pixel equality.

Full motion comparisons on all four supplied illustrations are now exported and visually inspected. The comparison uses equal durations for each input. The reference analyzes 1280x720; this editor still analyzes a 960x540 source canvas and exports 1280x720, so this is not a resolution-controlled benchmark. Final bytes match that analyzed source canvas on all four, not the untouched 1280x720 input file.

The initial opposite-neighbor gradient missed an isolated dark pixel and the interior of one-pixel horizontal, vertical and diagonal strokes in new synthetic regressions. A separable 15-pixel Gaussian local threshold replaces that gradient-only mask. This is the same general sketch-pass approach used by the reference, independently implemented in TypeScript with no new runtime dependency. Thin source strokes stay solid; the interior of a large flat color region stays unfilled. Source RGB remains immutable. All six new tests pass, including dimensions and determinism; the four stroke tests failed against the preceding mask. Arabic sketch-pass readability is visibly better in the inspected corpus, but this is not an OCR or semantic proof for every dot and mark.

Frame-to-frame hand displacement is mixed, not a quality win: p95 is worse than the reference on the seedling image (337 versus 242 output pixels), while maximum jumps are lower on the three newly compared illustrations. The mask fix does not change hand paths or these motion statistics. Stricter near-pen footprint checks, path quality and real Android/Windows tests remain. Native deployment and memory reduction are still open.

## Precise reveal and authored-boundary follow-up

Automatic scenes now request the same 65,536 timing bins as authored scenes. The coarse 256-bin route could reveal source ink after the pen had moved far away. A four-image browser audit measures the distance from each newly appearing sketch pixel to the pen at its reveal-bin boundary. The p95 distances in analysis-canvas pixels changed as follows: Basmala 27.64 to 10.93; tree 70.15 to 9.39; seedling 48.47 to 9.29; scale 54.47 to 11.34. This is a spatial timing metric, not a frame-rate, handwriting or overall quality score. Hand routes and the sampled hand-jump statistics are unchanged. A synthetic long-route test and the actual automatic/authored worker-request path guard this precision.

The retained cumulative table grows by 255 KiB per scene. At 960x540 the temporary worker arrays grow by about 1.49 MiB; they are not all retained by the editor. No dependency or model is added.

A separate synthetic probe found that rounding a global reveal bin could leave a few pixels of an accepted element unfinished at its exact end. Authored rendering now uses a compact component-to-element rank table against the plan's existing immutable raster labels. Earlier elements are complete and later elements stay hidden regardless of a rounded timing bin. The tree fixture needs a 968-byte rank table and does not duplicate its raster labels. Background pixels may contain faint JPEG halos of later objects; those background bytes are withheld until the completed source frame rather than leaking through the first element's color pass. They are not deleted.

Tests cover direct and outline/color modes, exact authored boundaries, the final unassigned remainder, faint background halos, backwards scrubbing and exact source pixels at completion. The actual browser tree project passes all boundary checks, and a 12-second export shows the manually reviewed flower, then tree, then remaining source ink, each completing both passes. The exported video and its first completed-element preview were visually inspected. This demonstrates reviewed ownership and timing, not perfect automatic semantic separation.

## Offline browser shell and isolated memory check

The installable browser shell is implemented and tested separately from native packaging. Its fixed core cache is about 2.01 MB uncompressed. Optional ONNX runtime assets add about 11.98 MB only when explicitly prepared with model installation. The 44.66 MB model weights are separate, stay in their existing IndexedDB model store, and are not duplicated in the static asset cache. These are asset byte counts, not installed APK/EXE size or RAM.

Real browser tests pass with the connection disabled: page reload, image import, worker analysis, project save/restore, first-use H.264 export with the cached muxer, and optional WASM inference (26 proposals in 26.8 to 28.2 seconds). Chrome's normal-profile installability check reports no errors. Actual Android/Windows OS installation is not performed. Updates wait while an old application window is open; a live two-version test confirmed no project reload and successful saved-project restoration after old windows closed. Screenshots at 320/390 pixels, desktop and the update state were inspected. Cache contracts restrict interception to fixed same-origin static GET assets and preserve unrelated caches and project storage. See PWA-OFFLINE.md.

A fresh isolated desktop Chrome run provides a better memory bound than aggregate RSS: process-tree PSS was about 540 MiB before model inference, 994 MiB peak and 477 MiB five seconds after worker termination. Peak increase was about 454 MiB. It produced 26 proposals in 27.0 seconds, with no off-origin requests or page errors. PSS apportions shared mappings; these figures still include the browser and editor, not pure model allocation, and say nothing definitive about Android. Inference must not yet be described as lightweight on actual phones.

## Reference sources

- https://github.com/daslearning-org/image-to-animation-offline
- https://github.com/daslearning-org/image-to-animation-offline/blob/main/kivy/sketchApi.py
- https://github.com/daslearning-org/image-to-animation-offline/releases/tag/v1.0.1
- https://huggingface.co/Acly/MobileSAM
- https://github.com/chaoningzhang/mobilesam
- https://github.com/microsoft/onnxruntime/blob/master/LICENSE
- https://github.com/microsoft/onnxruntime/blob/main/ThirdPartyNotices.txt

Reference rendering functions were run for comparison outside this project. No reference application source or hand assets were copied into this app.

## iPhone Home Screen follow-up

The browser shell now includes iPhone/iPad installation steps from Safari, Open as Web App guidance when available, an opaque 180px Apple touch icon and standalone metadata. Safe-area padding, a scrollable project dialog and touch-size installation controls are included. The guidance is hidden in standalone mode. A deliberate Storage API persistence request reports granted, refused and failed results without replacing backups.

Offline readiness is checked against the active worker's actual core assets, including after resuming a suspended app. A missing asset yields a warning without reloading or deleting the current scene. Worker/manifest deployment cache headers and worker updateViaCache are explicit. Existing no-forced-activation and waiting-update behavior remain.

The full build passes, including new iPhone/iPad platform-guidance, standalone, storage failure and cache-loss contracts. A desktop Chromium iPhone UI profile verifies the 320/390px instructions, no horizontal overflow, offline import/analysis/save/reload, installed-state behavior and cache-loss warning. The two-version no-reload update test and fully offline inference/export tests pass again. Actual Safari/iPhone installation, media encoding, mobile memory and battery remain untested. Installation support must not be described as full iPhone acceptance. See PWA-OFFLINE.md for platform references and exact user steps.
