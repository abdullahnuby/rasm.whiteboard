"""OpenCV-backed raster segmentation ported from TypeScript Engine v2.

The public contract keeps raster labels in a uint32 NumPy array. Do not
serialize a per-pixel label map as JSON; the browser bridge must transfer it
using a binary envelope.
"""
from __future__ import annotations

import math
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass

import cv2
import numpy as np
from numpy.typing import NDArray

from .geometry import Rect

RGBA8 = NDArray[np.uint8]
LabelMap = NDArray[np.uint32]


@dataclass(frozen=True, slots=True)
class SegmentationOptions:
    color_threshold: float = 26.0
    min_component_area: int = 1

    def validate(self) -> None:
        if not math.isfinite(self.color_threshold) or self.color_threshold < 0:
            raise ValueError("Color threshold must be finite and non-negative.")
        if (isinstance(self.min_component_area, bool)
                or not isinstance(self.min_component_area, int)
                or self.min_component_area < 1):
            raise ValueError("Minimum component area must be a positive integer.")


@dataclass(frozen=True, slots=True)
class ComponentRecord:
    id: int
    area: int
    bounds: Rect


@dataclass(frozen=True, slots=True)
class ElementRecord:
    id: int
    component_ids: tuple[int, ...]
    area: int
    bounds: Rect
    order_index: int


@dataclass(frozen=True, slots=True)
class ForegroundResult:
    mask: NDArray[np.uint8]
    background: tuple[int, int, int]
    density: float


@dataclass(frozen=True, slots=True)
class LabelResult:
    labels: LabelMap
    components: tuple[ComponentRecord, ...]
    backend: str


@dataclass(frozen=True, slots=True)
class RasterAnalysis:
    schema_version: int
    width: int
    height: int
    raster_labels: LabelMap
    components: tuple[ComponentRecord, ...]
    elements: tuple[ElementRecord, ...]
    background: tuple[int, int, int]
    foreground_density: float
    backend: str
    diagnostics: dict[str, object]


def _validate_dimensions(width: int, height: int) -> None:
    if (isinstance(width, bool) or isinstance(height, bool)
            or not isinstance(width, int) or not isinstance(height, int)
            or width < 3 or height < 3):
        raise ValueError("Raster dimensions must be integers of at least 3 by 3.")


def _as_rgba8(pixels: object, width: int, height: int) -> RGBA8:
    image = np.asarray(pixels)
    if image.dtype != np.uint8:
        raise TypeError("Image input must use uint8 RGBA pixels.")
    if image.ndim == 1 and image.size == width * height * 4:
        image = image.reshape((height, width, 4))
    if image.shape != (height, width, 4):
        raise TypeError("RGBA buffer size does not match raster dimensions.")
    return np.ascontiguousarray(image)


def _sample_background(image: RGBA8) -> tuple[int, int, int]:
    height, width, _ = image.shape
    samples: list[NDArray[np.uint8]] = []
    step = max(1, min(width, height) // 180)

    def add(x: int, y: int) -> None:
        pixel = image[y, x]
        if int(pixel[3]) >= 16:
            samples.append(pixel[:3].copy())

    for x in range(0, width, step):
        add(x, 0)
        add(x, height - 1)
    for y in range(step, height - 1, step):
        add(0, y)
        add(width - 1, y)

    if not samples:
        return (255, 255, 255)
    values = np.asarray(samples, dtype=np.uint8)
    middle = len(values) // 2
    # The TS reference uses sorted[floor(n/2)] (upper median for even n).
    return tuple(
        int(np.partition(values[:, channel], middle)[middle])
        for channel in range(3)
    )


def build_foreground_mask(
    pixels: object,
    width: int,
    height: int,
    options: SegmentationOptions | None = None,
) -> ForegroundResult:
    _validate_dimensions(width, height)
    options = options or SegmentationOptions()
    options.validate()
    image = _as_rgba8(pixels, width, height)
    background = _sample_background(image)

    rgb = image[:, :, :3].astype(np.float32)
    alpha = image[:, :, 3] >= 16
    dr = rgb[:, :, 0] - background[0]
    dg = rgb[:, :, 1] - background[1]
    db = rgb[:, :, 2] - background[2]
    # Preserve the exact threshold formula used by Engine v2.
    colour_distance = np.sqrt((dr * 0.92) ** 2 + dg ** 2 + (db * 0.92) ** 2)
    channel_contrast = np.maximum(
        np.maximum(np.abs(dr), np.abs(dg)), np.abs(db)
    )
    foreground = alpha & (
        (colour_distance >= options.color_threshold)
        | (channel_contrast >= options.color_threshold * 1.55)
    )
    mask = np.ascontiguousarray(foreground, dtype=np.uint8)
    return ForegroundResult(
        mask=mask,
        background=background,
        density=float(np.count_nonzero(mask) / max(1, width * height)),
    )


def _component_bounds(x: int, y: int, width: int, height: int) -> Rect:
    return Rect(
        x=float(x),
        y=float(y),
        width=float(width),
        height=float(height),
        cx=x + width / 2.0,
        cy=y + height / 2.0,
    )


def label_connected_components(
    mask: object,
    width: int,
    height: int,
    min_area: int = 1,
) -> LabelResult:
    _validate_dimensions(width, height)
    binary = np.asarray(mask, dtype=np.uint8)
    if binary.shape != (height, width):
        raise TypeError("Foreground mask size does not match raster dimensions.")
    if (isinstance(min_area, bool) or not isinstance(min_area, int)
            or min_area < 1):
        raise ValueError("Minimum component area must be a positive integer.")

    # SAUF preserves row-major label ordering, matching the JS raster scan.
    connected_with_algorithm = getattr(cv2, "connectedComponentsWithStatsWithAlgorithm", None)
    if connected_with_algorithm is not None and hasattr(cv2, "CCL_SAUF"):
        count, raw_labels, stats, _ = connected_with_algorithm(
            np.ascontiguousarray(binary),
            8,
            cv2.CV_32S,
            cv2.CCL_SAUF,
        )
    else:
        count, raw_labels, stats, _ = cv2.connectedComponentsWithStats(
            np.ascontiguousarray(binary),
            connectivity=8,
            ltype=cv2.CV_32S,
        )

    labels = raw_labels.astype(np.uint32, copy=True)
    components: list[ComponentRecord] = []
    filtered_ids: list[int] = []
    for component_id in range(1, count):
        x, y, component_width, component_height, area = (
            int(value) for value in stats[component_id]
        )
        if area < min_area:
            filtered_ids.append(component_id)
            continue
        components.append(
            ComponentRecord(
                id=component_id,
                area=area,
                bounds=_component_bounds(x, y, component_width, component_height),
            )
        )
    if filtered_ids:
        labels[np.isin(labels, np.asarray(filtered_ids, dtype=np.uint32))] = 0
    return LabelResult(
        labels=labels,
        components=tuple(components),
        backend="opencv-connected-components-8",
    )


def _encloses(outer: Rect, inner: Rect) -> bool:
    padding_x = max(1.0, outer.width * 0.025)
    padding_y = max(1.0, outer.height * 0.025)
    return (
        outer.width >= inner.width * 1.35
        and outer.height >= inner.height * 1.35
        and inner.x >= outer.x + padding_x
        and inner.y >= outer.y + padding_y
        and inner.x + inner.width <= outer.x + outer.width - padding_x
        and inner.y + inner.height <= outer.y + outer.height - padding_y
    )


def _attach_small_mark(small: ComponentRecord, large: ComponentRecord) -> bool:
    if small.area > large.area * 0.22:
        return False
    a, b = small.bounds, large.bounds
    gap_x = max(0.0, max(a.x, b.x) - min(a.x + a.width, b.x + b.width))
    gap_y = max(0.0, max(a.y, b.y) - min(a.y + a.height, b.y + b.height))
    aligned = abs(a.cx - b.cx) <= max(5.0, b.width * 0.45)
    return (
        a.width <= max(5.0, b.width * 0.72)
        and a.height <= max(5.0, b.height * 0.6)
        and aligned
        and gap_y <= max(7.0, b.height * 0.55)
        and gap_x <= max(4.0, b.width * 0.35)
    )


def _tier_for(value: float) -> int:
    return math.floor(math.log2(value)) if value >= 1.0 else -1


def group_components(
    components: Iterable[ComponentRecord],
) -> tuple[ElementRecord, ...]:
    items = list(components)
    if not items:
        return ()

    parents = list(range(len(items)))

    def find(value: int) -> int:
        while parents[value] != value:
            parents[value] = parents[parents[value]]
            value = parents[value]
        return value

    def join(left: int, right: int) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parents[right_root] = left_root

    cell_size = 48.0
    spatial_index: dict[int, dict[tuple[int, int], list[int]]] = {}
    attachment_index: dict[int, dict[tuple[int, int], list[int]]] = {}

    def insert(
        index: dict[int, dict[tuple[int, int], list[int]]],
        tier: int,
        key: tuple[int, int],
        item_index: int,
    ) -> None:
        index.setdefault(tier, {}).setdefault(key, []).append(item_index)

    for index, component in enumerate(items):
        bounds = component.bounds
        cell = (
            math.floor(bounds.cx / cell_size),
            math.floor(bounds.cy / cell_size),
        )
        insert(
            spatial_index,
            _tier_for(max(bounds.width, bounds.height)),
            cell,
            index,
        )
        insert(attachment_index, _tier_for(component.area), cell, index)

    def visit_candidates(
        index: dict[int, dict[tuple[int, int], list[int]]],
        maximum_metric: float,
        min_x: float,
        max_x: float,
        min_y: float,
        max_y: float,
        visit: Callable[[int], None],
    ) -> None:
        maximum_tier = _tier_for(maximum_metric)
        if maximum_tier < 0:
            return
        min_cell_x = math.floor(min_x / cell_size)
        max_cell_x = math.floor(max_x / cell_size)
        min_cell_y = math.floor(min_y / cell_size)
        max_cell_y = math.floor(max_y / cell_size)
        for tier in range(maximum_tier + 1):
            cells = index.get(tier)
            if not cells:
                continue
            for cell_y in range(min_cell_y, max_cell_y + 1):
                for cell_x in range(min_cell_x, max_cell_x + 1):
                    for candidate_index in cells.get((cell_x, cell_y), ()):
                        visit(candidate_index)

    for parent_index, parent in enumerate(items):
        bounds = parent.bounds
        enclosure_limit = min(bounds.width, bounds.height) / 1.35

        def check_enclosure(candidate_index: int) -> None:
            if (parent_index != candidate_index
                    and _encloses(bounds, items[candidate_index].bounds)):
                join(parent_index, candidate_index)

        visit_candidates(
            spatial_index,
            enclosure_limit,
            bounds.x,
            bounds.x + bounds.width,
            bounds.y,
            bounds.y + bounds.height,
            check_enclosure,
        )

        attach_area_limit = parent.area * 0.22
        range_x = max(5.0, bounds.width * 0.45)
        range_y = (
            bounds.height * 0.5
            + max(2.5, bounds.height * 0.3)
            + max(7.0, bounds.height * 0.55)
        )

        def check_attachment(candidate_index: int) -> None:
            if (parent_index != candidate_index
                    and _attach_small_mark(items[candidate_index], parent)):
                join(parent_index, candidate_index)

        visit_candidates(
            attachment_index,
            attach_area_limit,
            bounds.cx - range_x,
            bounds.cx + range_x,
            bounds.cy - range_y,
            bounds.cy + range_y,
            check_attachment,
        )

    grouped: dict[int, list[ComponentRecord]] = {}
    for index, component in enumerate(items):
        grouped.setdefault(find(index), []).append(component)

    result: list[ElementRecord] = []
    for members in grouped.values():
        first = members[0].bounds
        min_x, min_y = first.x, first.y
        max_x = first.x + first.width
        max_y = first.y + first.height
        for member in members[1:]:
            bounds = member.bounds
            min_x = min(min_x, bounds.x)
            min_y = min(min_y, bounds.y)
            max_x = max(max_x, bounds.x + bounds.width)
            max_y = max(max_y, bounds.y + bounds.height)
        union = Rect(
            x=min_x,
            y=min_y,
            width=max_x - min_x,
            height=max_y - min_y,
            cx=(min_x + max_x) / 2.0,
            cy=(min_y + max_y) / 2.0,
        )
        result.append(
            ElementRecord(
                id=0,
                component_ids=tuple(member.id for member in members),
                area=sum(member.area for member in members),
                bounds=union,
                order_index=0,
            )
        )
    return tuple(result)


def analyze_raster(
    pixels: object,
    width: int,
    height: int,
    options: SegmentationOptions | None = None,
) -> RasterAnalysis:
    _validate_dimensions(width, height)
    options = options or SegmentationOptions()
    options.validate()
    started = time.perf_counter()

    foreground = build_foreground_mask(pixels, width, height, options)
    labelled = label_connected_components(
        foreground.mask, width, height, options.min_component_area
    )
    labels = labelled.labels
    components = list(labelled.components)
    effective_density = foreground.density
    warnings: list[str] = []
    pixel_count = width * height

    if foreground.density > 0.72:
        labels = np.ones((height, width), dtype=np.uint32)
        components = [
            ComponentRecord(
                1,
                pixel_count,
                Rect(0.0, 0.0, float(width), float(height), width / 2.0, height / 2.0),
            )
        ]
        effective_density = 1.0
        warnings.append(
            "The source has high foreground density and is treated as one photographic element; semantic segmentation is not assumed."
        )
    elif not components:
        labels = np.ones((height, width), dtype=np.uint32)
        components = [
            ComponentRecord(
                1,
                pixel_count,
                Rect(0.0, 0.0, float(width), float(height), width / 2.0, height / 2.0),
            )
        ]
        effective_density = 1.0
        warnings.append(
            "No distinct foreground was detected; the full canvas is retained as one element for diagnostics."
        )

    grouped = list(group_components(components))
    grouped.sort(key=lambda element: (element.bounds.cy, -element.bounds.cx))
    elements = tuple(
        ElementRecord(
            id=index + 1,
            component_ids=element.component_ids,
            area=element.area,
            bounds=element.bounds,
            order_index=index,
        )
        for index, element in enumerate(grouped)
    )
    component_to_element = {
        component_id: element.id
        for element in elements
        for component_id in element.component_ids
    }
    foreground_pixels = (
        pixel_count
        if effective_density >= 1.0
        else sum(component.area for component in components)
    )
    diagnostics: dict[str, object] = {
        "engine_version": "python-0.1.0",
        "phase": "segmentation",
        "width": width,
        "height": height,
        "pixel_count": pixel_count,
        "foreground_pixels": foreground_pixels,
        "background_pixels": pixel_count - foreground_pixels,
        "foreground_density": effective_density,
        "component_count": len(components),
        "element_count": len(elements),
        "labels_without_elements": sum(
            1 for component in components
            if component.id not in component_to_element
        ),
        "warnings": warnings,
        "durations_ms": {
            "segmentation": (time.perf_counter() - started) * 1000.0
        },
    }
    return RasterAnalysis(
        schema_version=1,
        width=width,
        height=height,
        raster_labels=labels,
        components=tuple(components),
        elements=elements,
        background=foreground.background,
        foreground_density=effective_density,
        backend=labelled.backend,
        diagnostics=diagnostics,
    )


__all__ = [
    "ComponentRecord",
    "ElementRecord",
    "ForegroundResult",
    "LabelResult",
    "RasterAnalysis",
    "SegmentationOptions",
    "analyze_raster",
    "build_foreground_mask",
    "group_components",
    "label_connected_components",
]
