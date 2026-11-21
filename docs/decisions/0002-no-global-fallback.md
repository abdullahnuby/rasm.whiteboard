# ADR 0002 — No global reveal fallback

- Status: Accepted
- Date: 2026-11-21

## Context

Global row-major and top-to-bottom fallbacks appeared visually plausible but violated element order and concealed missing routes.

## Decision

Worker failure falls back to the same deterministic Engine v2 scheduler on the main thread. If the scene cannot be scheduled because an element is missing a route or pixels are unowned, playback/export reports the error.

## Consequences

- Low-powered devices may take longer to prepare a scene.
- Incorrect output is never silently accepted as a successful render.
- Main-thread and worker results can be compared byte-for-byte in tests.
