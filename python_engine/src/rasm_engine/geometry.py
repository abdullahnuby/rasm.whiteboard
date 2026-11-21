"""Deterministic geometry primitives ported from TypeScript Engine v2."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Sequence, TypeAlias

Point: TypeAlias = tuple[float, float]


@dataclass(frozen=True, slots=True)
class Rect:
    x: float
    y: float
    width: float
    height: float
    cx: float
    cy: float


def _point(value: Sequence[float]) -> Point:
    if len(value) != 2:
        raise ValueError("A point must contain exactly two coordinates.")
    x, y = float(value[0]), float(value[1])
    if not math.isfinite(x) or not math.isfinite(y):
        raise ValueError("Point coordinates must be finite numbers.")
    return x, y


def _points(values: Iterable[Sequence[float]]) -> list[Point]:
    return [_point(value) for value in values]


def distance(a: Sequence[float], b: Sequence[float]) -> float:
    """Return Euclidean distance between two 2D points."""
    ax, ay = _point(a)
    bx, by = _point(b)
    return math.hypot(bx - ax, by - ay)


def bounds_of_points(values: Iterable[Sequence[float]]) -> Rect:
    """Match Engine v2 bounds semantics, including the empty zero rectangle."""
    points = _points(values)
    if not points:
        return Rect(0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
    min_x = min(point[0] for point in points)
    min_y = min(point[1] for point in points)
    max_x = max(point[0] for point in points)
    max_y = max(point[1] for point in points)
    return Rect(
        x=min_x, y=min_y,
        width=max_x - min_x, height=max_y - min_y,
        cx=(min_x + max_x) / 2.0, cy=(min_y + max_y) / 2.0,
    )


def path_length(values: Iterable[Sequence[float]]) -> float:
    """Sum consecutive segment lengths in a polyline."""
    points = _points(values)
    return sum(distance(points[index - 1], points[index]) for index in range(1, len(points)))


def simplify_path(values: Iterable[Sequence[float]], tolerance: float = 0.55) -> list[Point]:
    """Iterative Ramer-Douglas-Peucker simplification.

    Endpoint retention and the squared-distance threshold match the current
    TypeScript geometry implementation. An explicit stack avoids recursion
    depth failures on long input paths.
    """
    points = _points(values)
    tolerance = float(tolerance)
    if not math.isfinite(tolerance) or tolerance < 0:
        raise ValueError("Simplification tolerance must be finite and non-negative.")
    if len(points) <= 2:
        return points.copy()

    keep = bytearray(len(points))
    keep[0] = keep[-1] = 1
    stack: list[tuple[int, int]] = [(0, len(points) - 1)]
    limit = tolerance * tolerance

    while stack:
        first, last = stack.pop()
        ax, ay = points[first]
        bx, by = points[last]
        dx, dy = bx - ax, by - ay
        denominator = dx * dx + dy * dy
        farthest = limit
        farthest_index = -1

        for index in range(first + 1, last):
            px, py = points[index]
            fraction = 0.0 if denominator == 0 else ((px - ax) * dx + (py - ay) * dy) / denominator
            fraction = max(0.0, min(1.0, fraction))
            error_x = px - (ax + fraction * dx)
            error_y = py - (ay + fraction * dy)
            squared = error_x * error_x + error_y * error_y
            if squared > farthest:
                farthest = squared
                farthest_index = index

        if farthest_index >= 0:
            keep[farthest_index] = 1
            stack.append((first, farthest_index))
            stack.append((farthest_index, last))

    return [point for index, point in enumerate(points) if keep[index]]


__all__ = ["Point", "Rect", "bounds_of_points", "distance", "path_length", "simplify_path"]
