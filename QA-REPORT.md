# RASM Studio 6.0 — Engine v2 validation

## Scope
This is a structural replacement of the image-to-whiteboard pipeline, while preserving the existing editor shell, audio, timeline, export controls and .rasm project restore path.

## Architecture invariants
1. Every foreground raster component has one stable numeric label.
2. Every component belongs to exactly one drawable element.
3. Every extracted vector path is assigned to a component or retained as a separately diagnosed orphan; paths are not assigned to the nearest unrelated object.
4. A vector path crossing component ownership is split into owned path segments.
5. Every foreground component needs a pen-path seed. Missing centerlines use contour paths or a traced raster boundary; missing seeds are reported and do not trigger a row-major reveal.
6. Each element has a single hand-arrival-to-final-stroke window. Its raster pixels reveal only inside that element and component window.
7. Pen-up movement contributes to the same physical time as pen-down movement.
8. The main thread and Worker use the same Engine v2 reveal scheduler.
9. The preview and both export paths consume the same scene plan and normalized time.
10. Every scene can produce a downloadable JSON diagnostic report.

## New automated coverage
- Foreground mask, 8-connected components, detached small-mark grouping and one-pixel preservation.
- Path ownership assignment and splitting of one vector path crossing multiple raster components.
- RTL/LTR whole-element order.
- Centerline-missing route recovery by tracing the component's own raster outline.
- Complete first-element reveal before second-element reveal.
- Hard failure when a component has no pen path, rather than delayed appearance at scene end.
- Worker transfer contract, copied raster-label ownership and element-level schedule integration.
- Single physical hand-progress clock, pen-up interpolation and no legacy independent reveal timing.
- Static build guards for no top-down crop and playback readiness.
- Existing image engine, project restore, audio, timeline, reliability, export and development-server tests.

## Validation boundary
Automated tests use controlled synthetic rasters and vector paths; they establish architectural invariants but do not prove semantic recognition of every artistic composition. Visually connected Arabic writing may form one raster component, and images with textured/photographic backgrounds are kept as one explicitly diagnosed canvas element. Real iPhone/Safari playback and export still require user acceptance with the actual project.

No production merge is claimed by this report.
