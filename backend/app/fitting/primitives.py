"""Straight-line and circle fits plus point-to-curve distance helpers."""

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial import cKDTree

from app.fitting.types import Array


def distances_to_segment(pts: Array, a: Array, b: Array) -> Array:
    """Distance from each point to the finite segment a-b."""
    ab = b - a
    length_sq = float(ab @ ab)
    if length_sq <= 1e-18:
        return np.linalg.norm(pts - a, axis=1)
    t = np.clip(((pts - a) @ ab) / length_sq, 0.0, 1.0)
    return np.linalg.norm(pts - (a + t[:, None] * ab), axis=1)


def distances_to_polyline(pts: Array, poly: Array) -> Array:
    """Distance from each point to a polyline (exact, via the nearest vertex's edges)."""
    _, nearest = cKDTree(poly).query(pts)
    best = np.full(len(pts), np.inf)
    for offset in (-1, 0):
        start = np.clip(nearest + offset, 0, len(poly) - 2)
        a, b = poly[start], poly[start + 1]
        ab = b - a
        length_sq = np.maximum(np.sum(ab * ab, axis=1), 1e-18)
        t = np.clip(np.sum((pts - a) * ab, axis=1) / length_sq, 0.0, 1.0)
        best = np.minimum(best, np.linalg.norm(pts - (a + t[:, None] * ab), axis=1))
    return best


def line_error(pts: Array, a: Array, b: Array) -> float:
    return float(distances_to_segment(pts, a, b).max())


def fit_circle(pts: Array) -> tuple[Array, float, float] | None:
    """Least-squares circle through ``pts``: (center, radius, max radial error).

    Starts from the algebraic (Kåsa) solution and refines the geometric
    residual with Levenberg-Marquardt. Returns None for degenerate input.
    """
    if len(pts) < 3:
        return None
    x, y = pts[:, 0], pts[:, 1]
    design = np.column_stack((x, y, np.ones_like(x)))
    rhs = x**2 + y**2
    try:
        (cx2, cy2, c), *_ = np.linalg.lstsq(design, rhs, rcond=None)
    except np.linalg.LinAlgError:
        return None
    centre = np.array([cx2 / 2, cy2 / 2])
    radius_sq = c + centre @ centre
    if not np.isfinite(radius_sq) or radius_sq <= 0:
        return None
    radius = float(np.sqrt(radius_sq))

    def residual(params: Array) -> Array:
        return np.hypot(x - params[0], y - params[1]) - params[2]

    solution = least_squares(residual, np.array([centre[0], centre[1], radius]), method="lm")
    centre = solution.x[:2]
    radius = float(abs(solution.x[2]))
    if radius <= 0 or not np.all(np.isfinite(solution.x)):
        return None
    error = float(np.abs(np.hypot(x - centre[0], y - centre[1]) - radius).max())
    return centre, radius, error


def angular_coverage_ok(pts: Array, centre: Array, max_gap_degrees: float = 40.0) -> bool:
    """True when the points wrap all the way around ``centre`` without a big gap."""
    angles = np.sort(np.arctan2(pts[:, 1] - centre[1], pts[:, 0] - centre[0]))
    gaps = np.diff(np.concatenate((angles, [angles[0] + 2 * np.pi])))
    return bool(np.degrees(gaps.max()) <= max_gap_degrees)
