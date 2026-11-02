"""Turns an ordered Cartesian stroke into lines, circles and cubic Béziers.

Strategy for each stroke:
  1. A closed stroke that is accurately a full circle becomes one circle.
  2. Otherwise the stroke is cut at sharp corners (Béziers must not round them).
  3. Each corner-free piece becomes a straight line if one is within the
     tolerance, else an adaptive piecewise cubic Bézier. Béziers that turn out
     to be straight are demoted to lines.
Every piece shares its end points with its neighbours, so curves have no gaps.
"""

import numpy as np
from scipy.ndimage import gaussian_filter1d

from app.fitting import primitives
from app.fitting.bezier import bezier_points, fit_cubic, unit
from app.fitting.corners import detect_corners
from app.fitting.types import Array, FitSummary, FittedCurve, Segment

MIN_CIRCLE_POINTS = 8
# Pixel traces are staircases; smoothing over ~this many samples removes the
# jitter so that straight edges fit as lines. Errors are still measured
# against the unsmoothed trace.
SMOOTHING_SIGMA_SAMPLES = 1.5
_ERROR_SAMPLES_PER_POINT = 2
_MIN_ERROR_SAMPLES = 32


def _dedupe(pts: Array, closed: bool) -> Array:
    pts = np.asarray(pts, dtype=np.float64).reshape(-1, 2)
    if len(pts) < 2:
        return pts
    keep = np.concatenate(([True], np.linalg.norm(np.diff(pts, axis=0), axis=1) > 1e-12))
    pts = pts[keep]
    if closed and len(pts) > 1 and np.linalg.norm(pts[0] - pts[-1]) <= 1e-12:
        pts = pts[:-1]
    return pts


def _smooth(pts: Array, closed: bool) -> Array:
    if len(pts) < 5:
        return pts
    smoothed = gaussian_filter1d(
        pts, SMOOTHING_SIGMA_SAMPLES, axis=0, mode="wrap" if closed else "nearest"
    )
    if not closed:
        smoothed[0], smoothed[-1] = pts[0], pts[-1]
    return smoothed


def _cumulative(pts: Array) -> Array:
    return np.concatenate(([0.0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))))


def _tangent_forward(pts: Array, window: float) -> Array:
    """Unit tangent at pts[0] pointing along the path."""
    s = _cumulative(pts)
    j = min(int(np.searchsorted(s, window, side="left")), len(pts) - 1)
    return unit(pts[max(j, 1)] - pts[0])


def _tangent_backward(pts: Array, window: float) -> Array:
    """Unit tangent at pts[-1] pointing back into the path."""
    return _tangent_forward(pts[::-1], window)


def _line_segment(a: Array, b: Array, pts: Array) -> Segment:
    return Segment("line", np.array([a, b]), primitives.line_error(pts, a, b))


def _bezier_segment(ctrl: Array, data: Array) -> Segment:
    chord = ctrl[3] - ctrl[0]
    # Demote near-straight cubics to lines: simpler for the same accuracy.
    if np.linalg.norm(chord) > 1e-12:
        inner = primitives.distances_to_segment(ctrl[1:3], ctrl[0], ctrl[3])
        if inner.max() <= 1e-6 * max(1.0, float(np.linalg.norm(chord))):
            return _line_segment(ctrl[0], ctrl[3], data)
    count = max(_MIN_ERROR_SAMPLES, _ERROR_SAMPLES_PER_POINT * len(data))
    poly = bezier_points(ctrl, np.linspace(0.0, 1.0, count))
    error = float(primitives.distances_to_polyline(data, poly).max())
    return Segment("bezier", ctrl, error)


def _fit_piece(
    piece: Array,
    raw: Array,
    tolerance: float,
    window: float,
    t_start: Array | None,
    t_end: Array | None,
) -> list[Segment]:
    """Fit one corner-free run of smoothed points ``piece``.

    ``raw`` holds the matching unsmoothed points, used to report errors.
    ``t_*`` override the end tangents when given.
    """
    a, b = piece[0], piece[-1]
    if len(piece) == 2 or primitives.line_error(piece, a, b) <= tolerance:
        return [_line_segment(a, b, raw)]

    t1 = t_start if t_start is not None else _tangent_forward(piece, window)
    t2 = t_end if t_end is not None else _tangent_backward(piece, window)
    segments: list[Segment] = []
    for ctrl, lo, hi in fit_cubic(piece, t1, t2, tolerance):
        segments.append(_bezier_segment(ctrl, raw[lo : hi + 1]))
    return segments


def _fit_closed_polygon(pts: Array) -> list[Segment]:
    """Tiny closed strokes: join the points with straight lines."""
    n = len(pts)
    return [_line_segment(pts[i], pts[(i + 1) % n], pts[[i, (i + 1) % n]]) for i in range(n)]


def _try_circle(raw: Array, tolerance: float) -> Segment | None:
    if len(raw) < MIN_CIRCLE_POINTS:
        return None
    fit = primitives.fit_circle(raw)
    if fit is None:
        return None
    centre, radius, error = fit
    if error > tolerance or not primitives.angular_coverage_ok(raw, centre):
        return None
    return Segment(
        "circle",
        np.empty((0, 2)),
        error,
        center=(float(centre[0]), float(centre[1])),
        radius=radius,
    )


def _slice(arr: Array, lo: int, hi: int) -> Array:
    """``arr[lo..hi]`` inclusive, wrapping around the end when ``hi <= lo``."""
    if hi <= lo:
        return np.vstack((arr[lo:], arr[: hi + 1]))
    return arr[lo : hi + 1]


def fit_stroke(
    points: Array,
    closed: bool,
    tolerance: float,
    window: float,
    allow_circles: bool = True,
    circle_tolerance: float | None = None,
) -> FittedCurve:
    """Fit one stroke.

    tolerance: maximum allowed distance from the data to the fitted curve.
    window: arc-length scale (same units as ``points``) used to estimate
        tangents and find corners; roughly a few pixels' worth.
    circle_tolerance: maximum radial error for accepting a circle; defaults to
        ``tolerance``. Circles are judged against the raw points, so callers that
        shrink ``tolerance`` to allow for pixel jitter can pass the full value.
    """
    raw = _dedupe(points, closed)
    source = len(raw)
    if source < 2:
        return FittedCurve(closed, [], source)

    def piece_of(lo: int, hi: int, t1: Array | None = None, t2: Array | None = None) -> list[Segment]:
        raw_piece = _slice(raw, lo, hi)
        return _fit_piece(_smooth(raw_piece, False), raw_piece, tolerance, window, t1, t2)

    # Corners are found on the unsmoothed trace so smoothing never moves them.
    if not closed:
        corners = [c for c in detect_corners(raw, False, window) if 0 < c < source - 1]
        bounds = [0, *corners, source - 1]
        segments: list[Segment] = []
        for lo, hi in zip(bounds[:-1], bounds[1:], strict=True):
            segments += piece_of(lo, hi)
        return FittedCurve(False, segments, source)

    if source < 6:
        return FittedCurve(True, _fit_closed_polygon(raw) if source >= 3 else [], source)

    corners = detect_corners(raw, True, window)

    if allow_circles and not corners:
        circle = _try_circle(raw, tolerance if circle_tolerance is None else circle_tolerance)
        if circle is not None:
            return FittedCurve(True, [circle], source)

    segments = []
    if corners:
        # Cut the loop at each corner; the last piece wraps around to the first.
        for k, lo in enumerate(corners):
            segments += piece_of(lo, corners[(k + 1) % len(corners)])
    else:
        # Smooth loop: cut in two with a shared (central) tangent at each cut.
        pts = _smooth(raw, True)
        half = source // 2
        tangents = []
        for c in (0, half):
            ahead = np.roll(pts, -c, axis=0)
            behind = np.roll(pts[::-1], -(source - 1 - c), axis=0)
            tangents.append(unit(_tangent_forward(ahead, window) - _tangent_forward(behind, window)))
        segments += _fit_piece(
            pts[: half + 1], raw[: half + 1], tolerance, window, tangents[0], -tangents[1]
        )
        segments += _fit_piece(
            _slice(pts, half, 0), _slice(raw, half, 0), tolerance, window, tangents[1], -tangents[0]
        )
    return FittedCurve(True, segments, source)


def summarize(curves: list[FittedCurve]) -> FitSummary:
    segments = [s for c in curves for s in c.segments]
    errors = [s.max_error for s in segments]
    return FitSummary(
        curve_count=len(curves),
        segment_count=len(segments),
        line_count=sum(s.type == "line" for s in segments),
        bezier_count=sum(s.type == "bezier" for s in segments),
        circle_count=sum(s.type == "circle" for s in segments),
        max_error=max(errors, default=0.0),
        mean_error=float(np.mean(errors)) if errors else 0.0,
    )
