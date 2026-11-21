# ADR 0003 — Workers execute pure engine stages

- Status: Accepted
- Date: 2026-11-21

## Context

Worker code previously accepted partial lists of strokes and reconstructed missing state. The main thread and worker could operate on different scene representations.

## Decision

Workers accept versioned, validated typed payloads containing dimensions, raster ownership labels, element groups, line ownership and physical travel distance. They call the same pure scheduling module as the main thread.

## Consequences

- Transfer lists and payload schemas are explicit and testable.
- DOM/canvas objects never cross worker boundaries.
- Worker fallback can invoke the identical pure function.
