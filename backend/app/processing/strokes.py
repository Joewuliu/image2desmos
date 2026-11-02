"""Turn traced edge-pixel contours into open or closed strokes.

``cv2.findContours`` walks the boundary of a one-pixel-wide edge. A closed edge
loop is traced once around, but an *open* edge (a line segment, an arc, or an
outline with a small gap) is traced out along one side and back along the
other. The trace mirrors itself around each end of the stroke, so the ends are
the points where the two directions stay together longest. The trace between
two ends is the stroke itself.

Pixels visited only once do not mark the ends: on a diagonal staircase the
outward and return walks differ by a corner pixel at every step.
"""

import numpy as np
from numpy.typing import NDArray

PixelPoints = NDArray[np.int32]  # shape (N, 2): (x, y)

# A contour is treated as an out-and-back trace of an open stroke when at
# least this share of its pixels is visited more than once.
OPEN_REVISIT_FRACTION = 0.5
# The two walks away from a true end stay at least this long together;
# shorter mirrors are bristles on the edge, not ends.
MIN_ARM_PIXELS = 6
# An open stroke whose ends are this close is a loop with a detection gap.
CLOSE_GAP_PIXELS = 5


def _visit_counts(contour: PixelPoints) -> NDArray[np.int64]:
    keys = contour[:, 0].astype(np.int64) * 1_000_003 + contour[:, 1].astype(np.int64)
    _, inverse, counts = np.unique(keys, return_inverse=True, return_counts=True)
    return counts[inverse]


def _arm_lengths(contour: PixelPoints) -> NDArray[np.int64]:
    """For each index, how far the trace stays mirrored around it (cyclically)."""
    n = len(contour)
    arms = np.zeros(n, dtype=np.int64)
    alive = np.arange(n)
    for k in range(1, n // 2 + 1):
        before = contour[(alive - k) % n]
        after = contour[(alive + k) % n]
        alive = alive[np.abs(before - after).max(axis=1) <= 1]
        if len(alive) == 0:
            break
        arms[alive] = k
    return arms


def _find_ends(contour: PixelPoints) -> list[int]:
    """Indices where the trace turns back: the strongest mirror in each neighbourhood."""
    n = len(contour)
    arms = _arm_lengths(contour)
    minimum = max(2, min(MIN_ARM_PIXELS, n // 4))
    ends: list[int] = []
    for i in np.argsort(-arms, kind="stable"):
        if arms[i] < minimum:
            break
        # An end's arm can span the whole stroke, so suppress only its close neighbours.
        reach = min(int(arms[i]), MIN_ARM_PIXELS)
        if all(min((i - e) % n, (e - i) % n) > reach for e in ends):
            ends.append(int(i))
    return sorted(ends)


def _longest_fresh_run(keys: list[tuple[int, int]], covered: set[tuple[int, int]]) -> tuple[int, int]:
    """Start and length of the longest run of keys not yet in ``covered``."""
    best_start, best_length, start = 0, 0, None
    for i, key in enumerate([*keys, None]):
        if key is not None and key not in covered:
            start = i if start is None else start
            continue
        if start is not None and i - start > best_length:
            best_start, best_length = start, i - start
        start = None
    return best_start, best_length


def contour_to_strokes(contour: PixelPoints) -> list[tuple[PixelPoints, bool]]:
    """Split one traced contour into ``(points, closed)`` strokes."""
    if len(contour) < 3:
        return [(contour, False)] if len(contour) == 2 else []

    visits = _visit_counts(contour)
    if float(np.mean(visits > 1)) < OPEN_REVISIT_FRACTION:
        return [(contour, True)]

    ends = _find_ends(contour)
    if len(ends) < 2:
        return [(contour, True)]
    if len(ends) == 2:
        stroke = contour[ends[0] : ends[1] + 1]
        gap = float(np.abs(stroke[0] - stroke[-1]).max())
        return [(stroke, gap <= CLOSE_GAP_PIXELS and len(stroke) > 2 * CLOSE_GAP_PIXELS)]

    # Branching strokes: each slice between consecutive ends walks two branches,
    # and every branch is walked twice overall. Keep each pixel path once by
    # taking the longest not-yet-covered run of every slice.
    strokes: list[tuple[PixelPoints, bool]] = []
    covered: set[tuple[int, int]] = set()
    for k, lo in enumerate(ends):
        hi = ends[(k + 1) % len(ends)]
        piece = (
            np.vstack((contour[lo:], contour[: hi + 1])) if hi <= lo else contour[lo : hi + 1]
        )
        keys = [(int(x), int(y)) for x, y in piece]
        start, length = _longest_fresh_run(keys, covered)
        if length >= MIN_ARM_PIXELS:
            # One pixel of overlap keeps the branch joined to what it grew from.
            first = max(start - 1, 0)
            strokes.append((piece[first : start + length], False))
        covered.update(keys)
    return strokes


def stroke_extent(points: PixelPoints) -> float:
    """Longest side of the stroke's bounding box, in pixels."""
    if len(points) == 0:
        return 0.0
    span = points.max(axis=0) - points.min(axis=0)
    return float(span.max())
