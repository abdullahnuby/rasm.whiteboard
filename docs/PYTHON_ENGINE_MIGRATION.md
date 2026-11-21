# RASM Python Engine migration plan

## Architecture decision

RASM remains a browser application. The browser owns interaction, canvas/GPU
presentation, timeline controls, and playback. A local Python process owns
CPU-heavy image and geometry work. Python is independent of the browser UI and
exposes a versioned local API.

The Python package lives under `python_engine/`. It does not silently bypass
or replace Engine v2. The current TypeScript implementation remains the
reference implementation during migration.

## Non-negotiable invariants

1. No expensive image, geometry, or route-planning operation may run on the
   browser main thread.
2. The browser must remain interactive while Python jobs run.
3. Every job must report phase, progress, elapsed time, and a useful failure
   reason; cancellation must stop work safely.
4. Large pixel buffers and vector arrays must use a documented binary contract,
   not JSON arrays of per-pixel values.
5. Preview and export must consume the same normalized drawing plan.
6. A migrated algorithm is not enabled by default until parity fixtures and
   real-project comparisons pass.
7. The existing .rasm project format and old-project adapters remain stable.
8. The local service binds to loopback only. Before browser access is enabled,
   implement pairing, request authentication, strict origin checks, bounded
   payloads, and a safe local-origin/HTTPS strategy. Do not add wildcard CORS.
9. Python must not receive arbitrary filesystem paths from the page; the page
   transfers bytes, and file access stays behind explicit user actions.
10. Measure wall time, peak memory, CPU time, output quality, and cancellation
    latency on the same fixtures before comparing implementations.

## Migration sequence

### Phase 0 — foundation (completed)

- Establish a separately installable Python package and local-only FastAPI
  process.
- Port deterministic geometry primitives with unit coverage.
- Add a separate Python CI workflow.
- Document the browser/Python ownership boundary and migration invariants.

### Phase 1 — image normalization and segmentation (in progress)

- Define the canonical RGBA8 input contract and image-size validation.
- Port the Engine v2 foreground/background threshold rules.
- Use OpenCV 8-connected components with stable row-major component IDs.
- Port detached small-mark grouping and photographic/high-density fallback.
- Compare label and element outputs on deterministic fixtures.
- Continue with contour/centreline extraction after segmentation parity.

### Phase 2 — vector extraction and geometry

- Port centreline/contour extraction and path simplification.
- Port component ownership, path splitting, orphan retention, and outline
  tracing.
- Preserve stable identifiers and diagnostic warnings.
- Compare paths using geometric tolerances and topology checks, not only
  serialized point equality.

### Phase 3 — route and motion planning

- Port element ordering, endpoint routing, cumulative distances, travel
  segments, and reveal timing.
- Keep one physical drawing clock for pen-down and pen-up movement.
- Verify RTL/LTR, user-defined zones, colour modes, and old project adapters.

### Phase 4 — jobs and browser bridge

- Add bounded job queue and worker-process execution for CPU-bound tasks.
- Add job status, progress events, cancellation, structured errors, and
  back-pressure.
- Implement secure browser-to-loopback pairing and binary upload/download.
- Keep Canvas/WebGL rendering and interactive playback in the browser.

### Phase 5 — migration and retirement

- Run both engines against the same fixtures.
- Keep shadow-comparison results and performance baselines.
- Enable Python by operation behind a feature flag only after quality and
  responsiveness acceptance.
- Remove TypeScript processing modules only after every dependent workflow has
  parity coverage and a rollback path.

## Acceptance gates

A port is not accepted because Python code runs. It must pass:

- Unit parity fixtures for normal, degenerate, and adversarial inputs.
- Integration tests covering image analysis through final drawing plan.
- Stress cases sized from real user projects.
- No silent drops, missing components, or unowned paths.
- No UI-thread processing and no unbounded queue growth.
- Memory and latency budgets recorded against the same machine and fixture.
- Cancellation and recovery tests.
- Browser acceptance in the actual supported browsers.

## Current status

Phase 0 is complete. Phase 1 segmentation is now implemented in the Python
package and has automated parity-oriented synthetic tests. The app still
uses TypeScript Engine v2 for all production processing; the Python service is
not yet called by the editor.
