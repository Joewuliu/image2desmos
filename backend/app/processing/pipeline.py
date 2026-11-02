"""Orchestrates the deterministic image -> contours pipeline."""

import base64
from dataclasses import dataclass, field

import cv2
import numpy as np
from numpy.typing import NDArray

from app.processing import contours as contour_ops
from app.processing import coordinates, edges, preprocess
from app.processing.params import MAX_TOTAL_POINTS, ProcessingParams


class TooComplexError(Exception):
    """Raised when the result would exceed the point budget (e.g. noisy input)."""

    def __init__(self, point_count: int) -> None:
        super().__init__(f"{point_count} points exceeds the {MAX_TOTAL_POINTS} point limit")
        self.point_count = point_count


@dataclass(frozen=True)
class ProcessingResult:
    contours: list[NDArray[np.float64]]  # Cartesian (x, y) per contour
    bounds: coordinates.Bounds
    working_width: int
    working_height: int
    canny_low: int
    canny_high: int
    blur_kernel: int
    epsilon_px: float
    edge_pixel_count: int
    edge_map: NDArray[np.uint8]  # 255 where an edge was detected
    warnings: list[str] = field(default_factory=list)

    @property
    def contour_count(self) -> int:
        return len(self.contours)

    @property
    def point_count(self) -> int:
        return sum(len(c) for c in self.contours)


def process_gray(gray: NDArray[np.uint8], params: ProcessingParams) -> ProcessingResult:
    """Run blur -> Canny -> contours -> simplification -> Cartesian conversion."""
    working = preprocess.limit_size(gray)
    height, width = working.shape

    blurred = preprocess.blur(working, params.blur_sigma)
    edge_map, low, high = edges.detect_edges(blurred, params.edge_sensitivity)

    raw = contour_ops.extract_contours(edge_map)
    epsilon = contour_ops.simplify_epsilon(params.simplify, width, height)
    simplified = contour_ops.filter_and_simplify(raw, epsilon, width, height)

    total = sum(len(c) for c in simplified)
    if total > MAX_TOTAL_POINTS:
        raise TooComplexError(total)

    cartesian = [coordinates.image_to_cartesian(c, width, height) for c in simplified]
    warnings: list[str] = []
    if not simplified:
        warnings.append("no_contours")

    return ProcessingResult(
        contours=cartesian,
        bounds=coordinates.image_bounds(width, height),
        working_width=width,
        working_height=height,
        canny_low=low,
        canny_high=high,
        blur_kernel=preprocess.gaussian_kernel_size(params.blur_sigma),
        epsilon_px=epsilon,
        edge_pixel_count=int(np.count_nonzero(edge_map)),
        edge_map=edge_map,
        warnings=warnings,
    )


def process_image(data: bytes, params: ProcessingParams) -> ProcessingResult:
    return process_gray(preprocess.decode_to_gray(data), params)


def edge_map_to_data_url(edge_map: NDArray[np.uint8]) -> str:
    """Encode edges as dark lines on a white background (a PNG data URL)."""
    ok, buf = cv2.imencode(".png", 255 - edge_map)
    if not ok:  # pragma: no cover - encoding a uint8 array does not fail
        raise RuntimeError("could not encode edge map")
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
