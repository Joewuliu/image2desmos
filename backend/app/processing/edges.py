"""Canny edge detection."""

import cv2
import numpy as np
from numpy.typing import NDArray

from app.processing.params import SENSITIVITY_RANGE

EdgeMap = NDArray[np.uint8]

_HIGH_AT_MIN_SENSITIVITY = 255.0
_HIGH_AT_MAX_SENSITIVITY = 30.0
_LOW_TO_HIGH_RATIO = 0.4


def canny_thresholds(sensitivity: float) -> tuple[int, int]:
    """Map sensitivity (0-100) to Canny (low, high) hysteresis thresholds.

    Higher sensitivity lowers both thresholds so fainter edges survive.
    """
    lo, hi = SENSITIVITY_RANGE
    t = (sensitivity - lo) / (hi - lo)
    high = _HIGH_AT_MIN_SENSITIVITY + t * (_HIGH_AT_MAX_SENSITIVITY - _HIGH_AT_MIN_SENSITIVITY)
    return round(high * _LOW_TO_HIGH_RATIO), round(high)


def detect_edges(gray: NDArray[np.uint8], sensitivity: float) -> tuple[EdgeMap, int, int]:
    """Return a binary (0/255) edge map plus the thresholds used."""
    low, high = canny_thresholds(sensitivity)
    return cv2.Canny(gray, low, high), low, high
