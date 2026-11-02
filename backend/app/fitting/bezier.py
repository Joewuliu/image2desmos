"""Adaptive least-squares fitting of piecewise cubic Béziers (Schneider's algorithm).

Given an ordered run of points and unit tangents at both ends, fit a single
cubic. If the worst point is farther than the tolerance, refine the parameter
values with Newton-Raphson; if that is not enough, split at the worst point
(using a shared tangent so the pieces join smoothly) and fit each half.
"""

import numpy as np

from app.fitting.types import Array

_MAX_REPARAM_ITERATIONS = 6


def bezier_points(ctrl: Array, t: Array) -> Array:
    t = np.asarray(t, dtype=np.float64)[:, None]
    mt = 1.0 - t
    return mt**3 * ctrl[0] + 3 * mt**2 * t * ctrl[1] + 3 * mt * t**2 * ctrl[2] + t**3 * ctrl[3]


def _first_derivative(ctrl: Array, t: Array) -> Array:
    t = t[:, None]
    mt = 1.0 - t
    return 3 * (
        mt**2 * (ctrl[1] - ctrl[0]) + 2 * mt * t * (ctrl[2] - ctrl[1]) + t**2 * (ctrl[3] - ctrl[2])
    )


def _second_derivative(ctrl: Array, t: Array) -> Array:
    t = t[:, None]
    mt = 1.0 - t
    return 6 * (mt * (ctrl[2] - 2 * ctrl[1] + ctrl[0]) + t * (ctrl[3] - 2 * ctrl[2] + ctrl[1]))


def chord_length_parameterize(pts: Array) -> Array:
    steps = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    cumulative = np.concatenate(([0.0], np.cumsum(steps)))
    total = cumulative[-1]
    if total <= 0:
        return np.linspace(0.0, 1.0, len(pts))
    return cumulative / total


def unit(v: Array) -> Array:
    norm = float(np.linalg.norm(v))
    return v / norm if norm > 1e-12 else np.array([1.0, 0.0])


def generate_bezier(pts: Array, u: Array, t1: Array, t2: Array) -> Array:
    """Least-squares cubic with fixed end points and end-tangent directions.

    ``t1`` points forward from the first point, ``t2`` points backward from
    the last point (into the curve).
    """
    p0, p3 = pts[0], pts[-1]
    b0 = (1 - u) ** 3
    b1 = 3 * u * (1 - u) ** 2
    b2 = 3 * u**2 * (1 - u)
    b3 = u**3

    a1 = t1[None, :] * b1[:, None]
    a2 = t2[None, :] * b2[:, None]
    c00, c01, c11 = np.sum(a1 * a1), np.sum(a1 * a2), np.sum(a2 * a2)
    residual = pts - (p0[None, :] * (b0 + b1)[:, None] + p3[None, :] * (b2 + b3)[:, None])
    x0, x1 = np.sum(a1 * residual), np.sum(a2 * residual)

    det = c00 * c11 - c01 * c01
    chord = float(np.linalg.norm(p3 - p0))
    alpha1 = alpha2 = 0.0
    if abs(det) > 1e-12:
        alpha1 = (x0 * c11 - x1 * c01) / det
        alpha2 = (c00 * x1 - c01 * x0) / det
    eps = 1e-6 * chord
    if alpha1 < eps or alpha2 < eps:
        alpha1 = alpha2 = chord / 3.0
    return np.array([p0, p0 + t1 * alpha1, p3 + t2 * alpha2, p3])


def _reparameterize(ctrl: Array, pts: Array, u: Array) -> Array:
    diff = bezier_points(ctrl, u) - pts
    d1 = _first_derivative(ctrl, u)
    d2 = _second_derivative(ctrl, u)
    numerator = np.sum(diff * d1, axis=1)
    denominator = np.sum(d1 * d1, axis=1) + np.sum(diff * d2, axis=1)
    safe = np.abs(denominator) > 1e-12
    step = np.zeros_like(u)
    step[safe] = numerator[safe] / denominator[safe]
    new_u = np.clip(u - step, 0.0, 1.0)
    new_u[0], new_u[-1] = 0.0, 1.0
    return new_u


def _worst_point(ctrl: Array, pts: Array, u: Array) -> tuple[float, int]:
    dist = np.linalg.norm(bezier_points(ctrl, u) - pts, axis=1)
    index = int(np.argmax(dist))
    return float(dist[index]), min(max(index, 1), len(pts) - 2)


def fit_cubic(
    pts: Array, t1: Array, t2: Array, tolerance: float
) -> list[tuple[Array, int, int]]:
    """Fit ``pts`` with as few cubics as needed.

    Returns ``(control_points, first_index, last_index)`` for each cubic, in
    order; consecutive cubics share their boundary index and end point.
    """
    result: list[tuple[Array, int, int]] = []
    # Explicit stack (rather than recursion) keeps deep splits safe. Entries
    # are pushed right-then-left so pieces pop in order.
    stack: list[tuple[int, int, Array, Array]] = [(0, len(pts) - 1, t1, t2)]
    while stack:
        lo, hi, left_tangent, right_tangent = stack.pop()
        piece = pts[lo : hi + 1]

        if len(piece) == 2:
            chord = float(np.linalg.norm(piece[1] - piece[0]))
            ctrl = np.array(
                [
                    piece[0],
                    piece[0] + left_tangent * chord / 3,
                    piece[1] + right_tangent * chord / 3,
                    piece[1],
                ]
            )
            result.append((ctrl, lo, hi))
            continue

        u = chord_length_parameterize(piece)
        ctrl = generate_bezier(piece, u, left_tangent, right_tangent)
        error, split = _worst_point(ctrl, piece, u)

        if error > tolerance:
            for _ in range(_MAX_REPARAM_ITERATIONS):
                u = _reparameterize(ctrl, piece, u)
                ctrl = generate_bezier(piece, u, left_tangent, right_tangent)
                error, split = _worst_point(ctrl, piece, u)
                if error <= tolerance:
                    break

        if error <= tolerance or len(piece) <= 3:
            result.append((ctrl, lo, hi))
            continue

        centre_tangent = unit(piece[split - 1] - piece[split + 1])
        mid = lo + split
        stack.append((mid, hi, -centre_tangent, right_tangent))
        stack.append((lo, mid, left_tangent, centre_tangent))
    return result
