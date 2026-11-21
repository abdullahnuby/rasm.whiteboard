import math

import pytest

from rasm_engine.geometry import bounds_of_points, distance, path_length, simplify_path


def test_distance_matches_euclidean_geometry():
    assert distance((0, 0), (3, 4)) == 5.0


def test_bounds_match_engine_v2_center_and_extent_semantics():
    bounds = bounds_of_points([(2, 8), (-4, 3), (6, -2)])
    assert (bounds.x, bounds.y, bounds.width, bounds.height) == (-4.0, -2.0, 10.0, 10.0)
    assert (bounds.cx, bounds.cy) == (1.0, 3.0)


def test_empty_bounds_are_zero_rect():
    assert bounds_of_points([]).x == 0.0
    assert bounds_of_points([]).width == 0.0
    assert bounds_of_points([]).cy == 0.0


def test_path_length_counts_only_consecutive_segments():
    assert path_length([(0, 0), (3, 4), (3, 8)]) == 9.0
    assert path_length([]) == 0.0
    assert path_length([(1, 1)]) == 0.0


def test_simplification_keeps_endpoints_and_removes_collinear_samples():
    simplified = simplify_path([(0, 0), (1, 0), (2, 0), (3, 0), (4, 0)])
    assert simplified == [(0.0, 0.0), (4.0, 0.0)]


def test_simplification_retains_a_significant_corner():
    simplified = simplify_path([(0, 0), (1, 0), (2, 0), (2, 4), (2, 5)], tolerance=0.5)
    assert simplified[0] == (0.0, 0.0)
    assert simplified[-1] == (2.0, 5.0)
    assert (2.0, 0.0) in simplified


@pytest.mark.parametrize("bad_point", [(math.nan, 0), (0, math.inf), (0, -math.inf)])
def test_non_finite_coordinates_are_rejected(bad_point):
    with pytest.raises(ValueError, match="finite"):
        distance((0, 0), bad_point)


@pytest.mark.parametrize("tolerance", [-1, math.nan, math.inf])
def test_invalid_simplification_tolerance_is_rejected(tolerance):
    with pytest.raises(ValueError, match="tolerance"):
        simplify_path([(0, 0), (1, 1)], tolerance=tolerance)


def test_long_polyline_simplifies_without_recursion_or_extra_vertices():
    points = [(float(index), 0.0) for index in range(20_000)]
    result = simplify_path(points, tolerance=0.1)
    assert result == [points[0], points[-1]]
