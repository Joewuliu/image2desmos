"""Image-space to Cartesian (Desmos) coordinate conversion.

Image space: origin top-left, x right, y DOWN, integer pixel indices.
Cartesian space: origin at the image centre, x right, y UP, with the longest
image side spanning ``span`` units. Pixel indices refer to pixel centres.
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.processing.params import CARTESIAN_SPAN

Points = NDArray[np.float64]


@dataclass(frozen=True)
class Bounds:
    min_x: float
    max_x: float
    min_y: float
    max_y: float


def unit_scale(width: int, height: int, span: float = CARTESIAN_SPAN) -> float:
    """Cartesian units per pixel."""
    return span / max(width, height)


def image_to_cartesian(
    points: NDArray[np.number], width: int, height: int, span: float = CARTESIAN_SPAN
) -> Points:
    """Convert an (N, 2) array of (x_px, y_px) to (x, y) Cartesian points."""
    pts = np.asarray(points, dtype=np.float64).reshape(-1, 2)
    s = unit_scale(width, height, span)
    out = np.empty_like(pts)
    out[:, 0] = (pts[:, 0] + 0.5 - width / 2) * s
    out[:, 1] = (height / 2 - (pts[:, 1] + 0.5)) * s  # flip y
    return out


def cartesian_to_image(
    points: NDArray[np.number], width: int, height: int, span: float = CARTESIAN_SPAN
) -> Points:
    """Inverse of :func:`image_to_cartesian`."""
    pts = np.asarray(points, dtype=np.float64).reshape(-1, 2)
    s = unit_scale(width, height, span)
    out = np.empty_like(pts)
    out[:, 0] = pts[:, 0] / s + width / 2 - 0.5
    out[:, 1] = height / 2 - pts[:, 1] / s - 0.5
    return out


def image_bounds(width: int, height: int, span: float = CARTESIAN_SPAN) -> Bounds:
    """Cartesian rectangle covered by the whole image."""
    s = unit_scale(width, height, span)
    half_w, half_h = width * s / 2, height * s / 2
    return Bounds(-half_w, half_w, -half_h, half_h)
