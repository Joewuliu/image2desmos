"""Turn traced edge-pixel contours into open or closed strokes.

``cv2.findContours`` walks the boundary of a one-pixel-wide edge. A closed edge
loop is traced once around, but an *open* edge (a line segment or arc) is
traced out along one side and back along the other, visiting every interior
pixel twice. Pixels visited exactly once are therefore the stroke's ends, and
the trace between two ends is the stroke itself.
"""

import numpy as np
from numpy.typing import NDArray

PixelPoints = NDArray[np.int32]  # shape (N, 2): (x, y)

# A contour is treated as an out-and-back trace of an open stroke when at
# least this share of its pixels is visited more than once.
OPEN_REVISIT_FRACTION = 0.5
# A branch slice is kept when more than this share of it is new pixels.
NEW_PIXEL_FRACTION = 0.5


def _visit_counts(contour: PixelPoints) -> NDArray[np.int64]:
    keys = contour[:, 0].astype(np.int64) * 1_000_003 + contour[:, 1].astype(np.int64)
    _, inverse, counts = np.unique(keys, return_inverse=True, return_counts=True)
    return counts[inverse]


def contour_to_strokes(contour: PixelPoints) -> list[tuple[PixelPoints, bool]]:
    """Split one traced contour into ``(points, closed)`` strokes."""
    if len(contour) < 3:
        return [(contour, False)] if len(contour) == 2 else []

    visits = _visit_counts(contour)
    if float(np.mean(visits > 1)) < OPEN_REVISIT_FRACTION:
        return [(contour, True)]

    ends = np.flatnonzero(visits == 1)
    if len(ends) < 2:
        return [(contour, True)]
    if len(ends) == 2:
        return [(contour[ends[0] : ends[1] + 1], False)]

    # Branching strokes: each slice between consecutive ends is one branch,
    # but every branch is also traced from the other side. Keep each pixel
    # path once by skipping slices that mostly repeat what is already covered.
    strokes: list[tuple[PixelPoints, bool]] = []
    covered: set[tuple[int, int]] = set()
    for k, lo in enumerate(ends):
        hi = ends[(k + 1) % len(ends)]
        piece = (
            np.vstack((contour[lo:], contour[: hi + 1])) if hi <= lo else contour[lo : hi + 1]
        )
        keys = [(int(x), int(y)) for x, y in piece]
        fresh = sum(key not in covered for key in keys)
        if fresh / len(keys) > NEW_PIXEL_FRACTION:
            strokes.append((piece, False))
        covered.update(keys)
    return strokes


def stroke_extent(points: PixelPoints) -> float:
    """Longest side of the stroke's bounding box, in pixels."""
    if len(points) == 0:
        return 0.0
    span = points.max(axis=0) - points.min(axis=0)
    return float(span.max())
