import numpy as np
import pytest

from app.processing.coordinates import (
    cartesian_to_image,
    image_bounds,
    image_to_cartesian,
    unit_scale,
)


def test_center_pixel_maps_to_origin() -> None:
    # A 101x101 image has a true centre pixel at index (50, 50).
    out = image_to_cartesian(np.array([[50, 50]]), 101, 101)
    assert out[0] == pytest.approx([0.0, 0.0])


def test_y_axis_is_flipped() -> None:
    top = image_to_cartesian(np.array([[50, 0]]), 101, 101)[0]
    bottom = image_to_cartesian(np.array([[50, 100]]), 101, 101)[0]
    assert top[1] > 0 > bottom[1]
    assert top[1] == pytest.approx(-bottom[1])


def test_x_axis_is_not_flipped() -> None:
    left = image_to_cartesian(np.array([[0, 50]]), 101, 101)[0]
    right = image_to_cartesian(np.array([[100, 50]]), 101, 101)[0]
    assert left[0] < 0 < right[0]


def test_longest_side_spans_requested_units() -> None:
    b = image_bounds(400, 200, span=20)
    assert (b.min_x, b.max_x) == (-10, 10)
    assert (b.min_y, b.max_y) == (-5, 5)
    assert unit_scale(400, 200, span=20) == pytest.approx(0.05)


def test_corners_stay_inside_bounds() -> None:
    w, h = 320, 180
    b = image_bounds(w, h)
    corners = image_to_cartesian(np.array([[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]), w, h)
    assert corners[:, 0].min() > b.min_x and corners[:, 0].max() < b.max_x
    assert corners[:, 1].min() > b.min_y and corners[:, 1].max() < b.max_y


def test_aspect_ratio_is_preserved() -> None:
    out = image_to_cartesian(np.array([[0, 0], [199, 99]]), 200, 100)
    dx, dy = out[1] - out[0]
    assert abs(dx) / abs(dy) == pytest.approx(199 / 99)


def test_round_trip() -> None:
    pts = np.array([[0, 0], [17, 93], [199, 99]], dtype=float)
    back = cartesian_to_image(image_to_cartesian(pts, 200, 100), 200, 100)
    assert back == pytest.approx(pts)


def test_empty_input() -> None:
    assert image_to_cartesian(np.empty((0, 2)), 10, 10).shape == (0, 2)
