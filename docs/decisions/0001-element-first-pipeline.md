# ADR 0001 — Element-first drawing pipeline

- Status: Accepted
- Date: 2026-11-21

## Context

The previous engine extracted a global list of edge paths, sorted nearby paths, then separately propagated pixels. This made a line, an image component and a semantic drawing element different implicit concepts. Worker and preview fallbacks could therefore reveal a different order from the hand.

## Decision

Introduce an explicit `DrawableElement` contract. It owns raster component IDs, ordered pen paths, bounds, start/end distances and diagnostics. All downstream consumers receive the same element plan.

## Consequences

- More up-front analysis and explicit memory ownership.
- Easier testing and fault localisation.
- No downstream code may reconstruct element ownership from bounding boxes or line order.
