"""Corner detection by turning angle over an arc-length window."""

import numpy as np

from app.fitting.types import Array

DEFAULT_CORNER_ANGLE_DEGREES = 45.0


def _turning_angles(pts: Array, s: Array, window: float) -> tuple[Array, Array]:
    """Turning angle at every point, using neighbours ``window`` arc-length away.

    Returns (angles, valid) where ``valid`` is False for points too close to
    an end of ``pts`` to have neighbours on both sides.
    """
    before = np.searchsorted(s, s - window, side="left")
    after = np.minimum(np.searchsorted(s, s + window, side="left"), len(pts) - 1)
    valid = (s - window >= -1e-12) & (s + window <= s[-1] + 1e-12)
    a = pts - pts[before]
    b = pts[after] - pts
    cross = a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]
    dot = np.sum(a * b, axis=1)
    return np.abs(np.arctan2(cross, dot)), valid


def detect_corners(
    pts: Array,
    closed: bool,
    window: float,
    angle_degrees: float = DEFAULT_CORNER_ANGLE_DEGREES,
) -> list[int]:
    """Indices of sharp corners, in increasing order.

    A point is a corner when the path turns by more than ``angle_degrees``
    across ``window`` units of arc length on either side, and it is the sharpest
    point within that window. End points of open strokes are never corners.
    """
    n = len(pts)
    if n < 5 or window <= 0:
        return []

    if closed:
        tiled = np.vstack((pts, pts, pts))
        steps = np.linalg.norm(np.diff(tiled, axis=0), axis=1)
        s = np.concatenate(([0.0], np.cumsum(steps)))
        angles, valid = _turning_angles(tiled, s, window)
        centre = slice(n, 2 * n)
        angles, s_mid = angles[centre], s[centre]
        valid_mid = valid[centre]
        s_all = s_mid
    else:
        steps = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        s = np.concatenate(([0.0], np.cumsum(steps)))
        angles, valid_mid = _turning_angles(pts, s, window)
        s_all = s

    threshold = np.radians(angle_degrees)
    candidates = np.flatnonzero((angles > threshold) & valid_mid)
    if len(candidates) == 0:
        return []

    kept: list[int] = []
    for i in candidates:
        lo = np.searchsorted(s_all, s_all[i] - window, side="left")
        hi = np.searchsorted(s_all, s_all[i] + window, side="right")
        neighbourhood = angles[lo:hi]
        peak = neighbourhood.max()
        # Among equal peaks keep the first one in the window.
        first_peak = lo + int(np.argmax(neighbourhood >= peak - 1e-12))
        if angles[i] >= peak - 1e-12 and first_peak == i:
            kept.append(int(i))

    # Closed paths: peaks near the seam can be duplicated across the wrap.
    if closed and len(kept) > 1:
        total = s_all[-1] - s_all[0] + float(np.linalg.norm(pts[0] - pts[-1]))
        if (s_all[kept[0]] + total) - s_all[kept[-1]] < window:
            kept.pop()
    return kept
