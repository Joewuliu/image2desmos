"""Contour extraction and polygon simplification."""

import cv2
import numpy as np
from numpy.typing import NDArray

from app.processing.params import MIN_CONTOUR_LENGTH_FRACTION

PixelContour = NDArray[np.int32]  # shape (N, 2): (x, y) in image pixels


def extract_contours(edges: NDArray[np.uint8]) -> list[PixelContour]:
    """Trace each connected edge component once.

    A one-pixel-wide closed edge loop yields two traces (outer and inner
    boundary). ``RETR_CCOMP`` labels inner boundaries as holes; those are
    skipped, while components nested inside a hole are still reported as
    top-level contours. Contours are ordered by their first pixel in raster
    order so output is deterministic.
    """
    found, hierarchy = cv2.findContours(edges, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if not found or hierarchy is None:
        return []
    kept = [
        c.reshape(-1, 2).astype(np.int32)
        for c, h in zip(found, hierarchy[0], strict=True)
        if h[3] == -1
    ]
    kept.sort(key=lambda c: (int(c[0, 1]), int(c[0, 0])))
    return kept


def simplify_epsilon(simplify: float, width: int, height: int) -> float:
    """Pixel tolerance for approxPolyDP; scales with image size."""
    return simplify * max(width, height) / 1000.0


def simplify_contour(contour: PixelContour, epsilon: float) -> PixelContour:
    if epsilon <= 0 or len(contour) < 3:
        return contour
    approx = cv2.approxPolyDP(contour.reshape(-1, 1, 2), epsilon, True)
    return approx.reshape(-1, 2).astype(np.int32)


def filter_and_simplify(
    contours: list[PixelContour], epsilon: float, width: int, height: int
) -> list[PixelContour]:
    """Drop specks, then simplify what remains. Contours with <2 points are dropped."""
    min_length = MIN_CONTOUR_LENGTH_FRACTION * max(width, height)
    result: list[PixelContour] = []
    for contour in contours:
        length = cv2.arcLength(contour.reshape(-1, 1, 2), True)
        if length < min_length:
            continue
        simplified = simplify_contour(contour, epsilon)
        if len(simplified) >= 2:
            result.append(simplified)
    return result
