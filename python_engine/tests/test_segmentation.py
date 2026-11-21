import numpy as np
import pytest

from rasm_engine.geometry import Rect
from rasm_engine.segmentation import (
    ComponentRecord,
    SegmentationOptions,
    analyze_raster,
    build_foreground_mask,
    group_components,
    label_connected_components,
)


def make_rgba(width, height, background=(255, 255, 255, 255)):
    image = np.empty((height, width, 4), dtype=np.uint8)
    image[:] = background
    return image


def paint(image, x0, y0, x1, y1, colour):
    image[y0 : y1 + 1, x0 : x1 + 1, :] = (*colour, 255)


def test_8_connected_components_keep_diagonal_pixels_together():
    mask = np.zeros((8, 8), dtype=np.uint8)
    mask[2, 2] = mask[3, 3] = mask[4, 4] = 1
    result = label_connected_components(mask, 8, 8)
    assert len(result.components) == 1
    assert result.components[0].area == 3
    assert result.labels[2, 2] == result.labels[4, 4]
    assert result.backend == "opencv-connected-components-8"


def test_segmentation_keeps_distinct_objects_and_attaches_detached_small_mark():
    width, height = 64, 32
    image = make_rgba(width, height)
    paint(image, 5, 9, 16, 22, (15, 80, 150))
    paint(image, 10, 5, 11, 6, (15, 80, 150))
    paint(image, 43, 9, 55, 22, (200, 35, 20))

    result = analyze_raster(image, width, height)
    assert len(result.components) == 3
    assert len(result.elements) == 2
    grouped = next(element for element in result.elements if len(element.component_ids) == 2)
    assert set(grouped.component_ids) == {1, 2}
    assert result.raster_labels[0, 0] == 0


def test_one_pixel_components_are_preserved_by_default():
    mask = np.zeros((12, 12), dtype=np.uint8)
    mask[5, 5] = 1
    result = label_connected_components(mask, 12, 12, 1)
    assert len(result.components) == 1
    assert result.components[0].area == 1


def test_minimum_area_filter_zeros_small_labels_without_renumbering_kept_labels():
    mask = np.zeros((20, 20), dtype=np.uint8)
    mask[1, 1] = 1
    mask[10:13, 10:13] = 1
    result = label_connected_components(mask, 20, 20, min_area=2)
    assert result.labels[1, 1] == 0
    assert len(result.components) == 1
    assert result.components[0].area == 9


def test_transparent_colours_do_not_become_foreground():
    image = make_rgba(12, 12, (20, 30, 40, 0))
    result = build_foreground_mask(image, 12, 12)
    assert result.mask.sum() == 0


def test_spatial_grouping_handles_thousands_of_unrelated_detached_components():
    components = []
    for index in range(5000):
        x = (index % 100) * 0.45
        y = (index // 100) * 0.45
        components.append(
            ComponentRecord(
                id=index + 1,
                area=1,
                bounds=Rect(x, y, 0.1, 0.1, x + 0.05, y + 0.05),
            )
        )
    groups = group_components(components)
    assert len(groups) == len(components)


def test_high_foreground_density_is_reported_as_one_photographic_canvas():
    width, height = 32, 32
    image = make_rgba(width, height)
    rng = np.random.default_rng(7)
    image[:, :, :3] = rng.integers(0, 255, size=(height, width, 3), dtype=np.uint8)
    result = analyze_raster(image, width, height)
    assert result.foreground_density == 1.0
    assert len(result.elements) == 1
    assert result.diagnostics["warnings"]


def test_bad_dimensions_and_non_rgba_input_are_rejected():
    with pytest.raises(ValueError, match="dimensions"):
        analyze_raster(np.zeros((2, 4, 4), dtype=np.uint8), 4, 2)
    with pytest.raises(TypeError, match="RGBA"):
        build_foreground_mask(np.zeros((8, 8, 3), dtype=np.uint8), 8, 8)


def test_invalid_segmentation_options_are_rejected():
    with pytest.raises(ValueError, match="Color threshold"):
        build_foreground_mask(
            make_rgba(8, 8),
            8,
            8,
            SegmentationOptions(color_threshold=float("nan")),
        )
    with pytest.raises(ValueError, match="Minimum component area"):
        label_connected_components(np.zeros((8, 8), dtype=np.uint8), 8, 8, True)
