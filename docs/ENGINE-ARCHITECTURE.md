# RASM Studio — Engine Architecture v2

## Purpose

RASM is an image-to-whiteboard video editor. Its core correctness rule is:

> A source pixel may become visible only as part of a drawable element that owns it, and only while the hand is drawing that element. The next element must not start until the current element is complete.

The old implementation split image extraction, line ordering, raster reveal, preview and export across independent scripts. Their fallbacks could silently use a top-to-bottom wipe or global pixel order. Engine v2 replaces that hidden coupling with one typed plan shared by preview, workers and export.

## Pipeline

`RGBA source → foreground mask → connected components → drawable elements → path ownership → path repair → reading order → physical hand plan → pixel reveal schedule → renderer/export`

### 1. Raster analysis

- Estimate the background from the image border.
- Build a foreground mask from colour distance rather than treating every pixel as an independent shape.
- Label 8-connected components with stable numeric IDs.
- Keep tiny components until grouping has classified them; Arabic dots must not be discarded as noise.
- Group only explicit relationships: small aligned marks attached to a base glyph, and components geometrically enclosed by a larger outline.
- Components that are merely adjacent remain separate.

The segmentation backend is replaceable. The deterministic JavaScript 8-connected implementation is the reference backend; OpenCV.js can be used as an optional accelerator and must pass the same fixture suite.

### 2. Path ownership

Every extracted centerline or contour is sampled against the raster ownership map. A path can be split when it genuinely crosses component ownership. It is never assigned to an unrelated nearest object merely because its bounding box is nearby.

The planner prefers centerlines, then uses contours for components that still lack a route. If both are absent, it traces the actual component boundary. There is no global longest-stroke filter and no invented canvas-wide straight line.

### 3. Drawable elements and order

A drawable element owns one or more raster component IDs and one or more pen paths. The order is top-to-bottom by text row and right-to-left by default within each row. Left-to-right is an explicit scene option. Manual zones may override reading order, but do not change pixel ownership.

Within an element, paths are routed deterministically: begin from the selected reading edge, then choose the nearest remaining endpoint. Pen-lift travel is included in the physical timeline.

### 4. Reveal schedule

The scheduler receives the exact same IDs and path plan as the hand renderer. For every non-background component:

- it must have at least one hand-path seed;
- its pixels are propagated only inside that component label;
- its reveal window is the first hand arrival through the final stroke completion of its owning element;
- its pixels cannot spill into another component or appear in a global row-major fallback.

A missing seed or uncovered component is a hard planning error with a diagnostic, not a reason to reveal the pixel at the last frame.

### 5. Preview, worker and export

- Image analysis runs in the image worker.
- The reveal worker runs the same Engine v2 schedule module.
- If a worker is unavailable, the main thread runs the same deterministic scheduler. It may be slower, but it must never change the reveal algorithm.
- Playback waits for the element schedule before advancing the playhead.
- Offline and live export call the same render function and consume the same scene plan.

## Source map

| Module | Responsibility |
|---|---|
| `src/engine-v2/types.ts` | Typed contracts between stages |
| `segmentation.ts` | Background estimation, foreground mask, 8-connected labels, element grouping |
| `path-ownership.ts` | Assign and split vector paths by raster ownership |
| `outline-tracer.ts` | Recover a real route from a raster component missing vector paths |
| `route-planner.ts` | Reading order, per-element path routing, pen-up travel |
| `planner.ts` | Assemble the immutable drawable-element plan |
| `reveal-scheduler.ts` | Convert element-owned paths into per-pixel reveal timestamps |
| `legacy-adapter.ts` | Temporary adapter for existing .rasm project/UI data |
| `worker-contract.ts` | Validated transferable worker messages |
| `diagnostics.ts` | Human-readable scene and element diagnostics |

## Invariants

1. Every non-zero raster label belongs to exactly one drawable element.
2. Every raster component must have at least one route seed.
3. Every source pixel must have an explicit reveal timestamp.
4. All strokes carry an element ID; raster strokes also carry a component ID.
5. Every element reveal window starts at hand arrival and ends at its final pen-down completion.
6. Worker and main-thread scheduling must call the same function.
7. A failure is reported. No row-major, top-down or arbitrary-order fallback is allowed.
8. Source analysis is immutable; changing direction/zones rebuilds the plan from the same analysis without re-segmenting the image.

## Diagnostics

Each scene stores a serializable report containing raster dimensions, foreground density, connected-component count, drawable-element count, input/assigned/split paths, contour/raster route recoveries, unseeded components, unassigned pixels, warnings and per-stage durations. Export this report when a scene is incorrect; it is the equivalent of an engine crash/diagnostic dump.

## Development

- `npm run typecheck`: strict TypeScript checks.
- `npm run test:engine-v2`: deterministic unit/integration tests.
- `npm run build`: typecheck, bundle browser + worker engine, run legacy and Engine v2 regression suites, then build the static application.

The current UI and .rasm persistence remain in the existing shell during migration. They are adapters, not the owner of image-analysis or reveal algorithms. The adapter can be removed when all UI/export paths use typed scene plans directly.
