"""Curve fitting on exact synthetic geometry (no image processing involved)."""

import numpy as np
import pytest

from app.fitting.bezier import bezier_points, fit_cubic, unit
from app.fitting.corners import detect_corners
from app.fitting.fitter import fit_stroke, summarize
from app.fitting.primitives import (
    angular_coverage_ok,
    distances_to_polyline,
    distances_to_segment,
    fit_circle,
)

TOL = 0.05
WINDOW = 0.3


def circle_points(r: float = 5.0, n: int = 200, centre: tuple[float, float] = (0.0, 0.0)):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return np.c_[centre[0] + r * np.cos(t), centre[1] + r * np.sin(t)]


def polyline(corners: list[tuple[float, float]], per_side: int = 100, closed: bool = True):
    pts = []
    ends = corners[1:] + ([corners[0]] if closed else [])
    for a, b in zip(corners, ends, strict=False):
        for u in np.linspace(0, 1, per_side, endpoint=False):
            pts.append((1 - u) * np.array(a) + u * np.array(b))
    if not closed:
        pts.append(np.array(corners[-1]))
    return np.array(pts)


def assert_connected(curve) -> None:
    """Consecutive segments share end points; closed curves wrap around."""
    segs = [s for s in curve.segments if s.type != "circle"]
    for a, b in zip(segs, segs[1:], strict=False):
        assert np.allclose(a.end, b.start), "gap between segments"
    if curve.closed and segs:
        assert np.allclose(segs[-1].end, segs[0].start), "closed curve does not close"


# ---- primitives -----------------------------------------------------------


def test_fit_circle_recovers_centre_and_radius() -> None:
    result = fit_circle(circle_points(3.0, 80, (2.0, -1.0)))
    assert result is not None
    centre, radius, error = result
    assert centre == pytest.approx([2.0, -1.0], abs=1e-6)
    assert radius == pytest.approx(3.0, abs=1e-6)
    assert error < 1e-6


def test_fit_circle_needs_three_points() -> None:
    assert fit_circle(np.array([[0.0, 0.0], [1.0, 1.0]])) is None


def test_angular_coverage_detects_arcs() -> None:
    pts = circle_points(2, 100)
    assert angular_coverage_ok(pts, np.zeros(2))
    assert not angular_coverage_ok(pts[:50], np.zeros(2))


def test_distance_helpers() -> None:
    a, b = np.array([0.0, 0.0]), np.array([10.0, 0.0])
    d = distances_to_segment(np.array([[5.0, 3.0], [-4.0, 3.0]]), a, b)
    assert d == pytest.approx([3.0, 5.0])
    poly = np.c_[np.linspace(0, 10, 11), np.zeros(11)]
    assert distances_to_polyline(np.array([[2.5, 1.0]]), poly) == pytest.approx([1.0])


# ---- Bézier core ----------------------------------------------------------


def test_fit_cubic_reproduces_a_known_bezier() -> None:
    ctrl = np.array([[0.0, 0.0], [1.0, 3.0], [4.0, 3.0], [5.0, 0.0]])
    pts = bezier_points(ctrl, np.linspace(0, 1, 60))
    t1, t2 = unit(ctrl[1] - ctrl[0]), unit(ctrl[2] - ctrl[3])
    fitted = fit_cubic(pts, t1, t2, 1e-3)
    assert len(fitted) == 1
    got = bezier_points(fitted[0][0], np.linspace(0, 1, 60))
    assert np.abs(got - pts).max() < 1e-3


def test_fit_cubic_splits_complex_shapes_into_gapless_pieces() -> None:
    x = np.linspace(0, 12, 400)
    pts = np.c_[x, 2 * np.sin(x)]
    fitted = fit_cubic(pts, unit(pts[3] - pts[0]), unit(pts[-4] - pts[-1]), 0.02)
    assert len(fitted) > 1
    assert fitted[0][1] == 0 and fitted[-1][2] == len(pts) - 1
    for (_, _, hi), (_, lo, _) in zip(fitted, fitted[1:], strict=False):
        assert hi == lo


# ---- corners --------------------------------------------------------------


def test_square_has_four_corners_and_circle_has_none() -> None:
    sq = polyline([(-5, -5), (5, -5), (5, 5), (-5, 5)])
    assert detect_corners(sq, True, WINDOW) == [0, 100, 200, 300]
    assert detect_corners(circle_points(), True, WINDOW) == []


def test_open_polyline_corners_exclude_end_points() -> None:
    pl = polyline([(0, 0), (5, 0), (5, 5)], closed=False)
    assert detect_corners(pl, False, WINDOW) == [100]


# ---- strokes --------------------------------------------------------------


def test_circle_becomes_a_single_circle_segment() -> None:
    curve = fit_stroke(circle_points(5, 200, (1, 2)), True, TOL, WINDOW)
    assert curve.closed and [s.type for s in curve.segments] == ["circle"]
    seg = curve.segments[0]
    assert seg.center == pytest.approx((1, 2), abs=1e-6)
    assert seg.radius == pytest.approx(5, abs=1e-6)
    assert seg.max_error < TOL


def test_circle_can_be_disabled_and_falls_back_to_beziers() -> None:
    curve = fit_stroke(circle_points(), True, TOL, WINDOW, allow_circles=False)
    assert {s.type for s in curve.segments} == {"bezier"}
    assert len(curve.segments) <= 6
    assert curve.max_error <= TOL
    assert_connected(curve)


def test_ellipse_is_not_mistaken_for_a_circle() -> None:
    t = np.linspace(0, 2 * np.pi, 300, endpoint=False)
    curve = fit_stroke(np.c_[8 * np.cos(t), 4 * np.sin(t)], True, TOL, WINDOW)
    assert "circle" not in {s.type for s in curve.segments}
    assert curve.max_error <= TOL
    assert_connected(curve)


def test_straight_line_is_one_line_segment() -> None:
    pts = np.c_[np.linspace(0, 10, 100), np.linspace(0, 5, 100)]
    curve = fit_stroke(pts, False, TOL, WINDOW)
    assert not curve.closed
    assert [s.type for s in curve.segments] == ["line"]
    assert np.allclose(curve.segments[0].start, pts[0])
    assert np.allclose(curve.segments[0].end, pts[-1])


def test_noisy_line_within_tolerance_is_still_a_line() -> None:
    rng = np.random.default_rng(1)
    x = np.linspace(0, 10, 200)
    pts = np.c_[x, 0.3 * x + rng.uniform(-0.01, 0.01, 200)]
    curve = fit_stroke(pts, False, TOL, WINDOW)
    assert [s.type for s in curve.segments] == ["line"]


def test_square_becomes_four_connected_lines() -> None:
    curve = fit_stroke(polyline([(-5, -5), (5, -5), (5, 5), (-5, 5)]), True, TOL, WINDOW)
    assert curve.closed
    assert [s.type for s in curve.segments] == ["line"] * 4
    assert_connected(curve)
    starts = {tuple(np.round(s.start, 6)) for s in curve.segments}
    assert starts == {(-5, -5), (5, -5), (5, 5), (-5, 5)}


def test_triangle_and_open_polyline_keep_their_corners() -> None:
    tri = fit_stroke(polyline([(0, 0), (8, 0), (4, 6)]), True, TOL, WINDOW)
    assert [s.type for s in tri.segments] == ["line"] * 3
    assert_connected(tri)

    zig = fit_stroke(polyline([(0, 0), (4, 4), (8, 0), (12, 4)], closed=False), False, TOL, WINDOW)
    assert not zig.closed
    assert [s.type for s in zig.segments] == ["line"] * 3
    assert_connected(zig)
    assert np.allclose(zig.segments[0].start, (0, 0))
    assert np.allclose(zig.segments[-1].end, (12, 4))


def test_open_arc_is_not_closed_and_has_no_gaps() -> None:
    t = np.linspace(0, np.pi, 120)
    curve = fit_stroke(np.c_[5 * np.cos(t), 5 * np.sin(t)], False, 0.02, WINDOW)
    assert not curve.closed
    assert all(s.type == "bezier" for s in curve.segments)
    assert curve.max_error <= 0.02
    assert_connected(curve)
    assert np.allclose(curve.segments[0].start, (5, 0))
    assert np.allclose(curve.segments[-1].end, (-5, 0), atol=1e-6)


def test_complex_closed_contour_stays_within_tolerance_and_is_connected() -> None:
    t = np.linspace(0, 2 * np.pi, 800, endpoint=False)
    heart = (
        np.c_[
            16 * np.sin(t) ** 3,
            13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t),
        ]
        / 3
    )
    curve = fit_stroke(heart, True, 0.03, WINDOW)
    assert curve.closed
    assert curve.max_error <= 0.03
    assert_connected(curve)
    assert 2 <= len(curve.segments) <= 20


def test_tighter_tolerance_needs_more_segments() -> None:
    x = np.linspace(0, 12, 600)
    pts = np.c_[x, 2 * np.sin(x) + 0.5 * np.sin(5 * x)]
    loose = fit_stroke(pts, False, 0.2, WINDOW)
    tight = fit_stroke(pts, False, 0.01, WINDOW)
    assert len(tight.segments) > len(loose.segments)
    assert loose.max_error <= 0.2


def test_degenerate_inputs() -> None:
    assert fit_stroke(np.empty((0, 2)), False, TOL, WINDOW).segments == []
    assert fit_stroke(np.array([[1.0, 1.0]]), False, TOL, WINDOW).segments == []
    two = fit_stroke(np.array([[0.0, 0.0], [3.0, 4.0]]), False, TOL, WINDOW)
    assert [s.type for s in two.segments] == ["line"]
    dup = fit_stroke(np.array([[0.0, 0.0]] * 5 + [[1.0, 0.0]] * 5), False, TOL, WINDOW)
    assert [s.type for s in dup.segments] == ["line"]


def test_fitting_is_deterministic() -> None:
    x = np.linspace(0, 12, 400)
    pts = np.c_[x, 2 * np.sin(x)]
    a = fit_stroke(pts, False, 0.02, WINDOW)
    b = fit_stroke(pts, False, 0.02, WINDOW)
    assert len(a.segments) == len(b.segments)
    for sa, sb in zip(a.segments, b.segments, strict=True):
        assert np.array_equal(sa.points, sb.points)


def test_summary_counts_and_errors() -> None:
    curves = [
        fit_stroke(circle_points(), True, TOL, WINDOW),
        fit_stroke(polyline([(0, 0), (5, 0), (5, 5)]), True, TOL, WINDOW),
    ]
    s = summarize(curves)
    assert (s.curve_count, s.circle_count, s.line_count, s.bezier_count) == (2, 1, 3, 0)
    assert s.segment_count == 4
    assert 0 <= s.mean_error <= s.max_error <= TOL
    assert summarize([]).segment_count == 0
