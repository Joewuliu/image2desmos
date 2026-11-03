"""Orchestrates the deterministic image -> contours pipeline."""

import base64
import time
from dataclasses import dataclass, field

import cv2
import numpy as np
from numpy.typing import NDArray

from app.fitting.fitter import fit_stroke, summarize
from app.fitting.types import FitSummary, FittedCurve
from app.processing import contours as contour_ops
from app.processing import coordinates, edges, preprocess, strokes
from app.processing.params import (
    FIT_JITTER_HEADROOM,
    FIT_WINDOW_FRACTION,
    FIT_WINDOW_MIN_PX,
    MAX_FIT_POINTS,
    MAX_SEGMENTS,
    MAX_TOTAL_POINTS,
    ProcessingParams,
)


class TooComplexError(Exception):
    """Raised when the result would exceed the point budget (e.g. noisy input)."""

    def __init__(self, count: int, limit: int = MAX_TOTAL_POINTS) -> None:
        super().__init__(f"{count} exceeds the limit of {limit}")
        self.count = count
        self.limit = limit


class ProcessingDeadlineError(Exception):
    """The job ran past its time limit and stopped between steps."""


def _check_deadline(deadline: float | None) -> None:
    if deadline is not None and time.monotonic() > deadline:
        raise ProcessingDeadlineError


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
    curves: list[FittedCurve] = field(default_factory=list)
    fit: FitSummary = field(default_factory=FitSummary)
    fit_tolerance_units: float = 0.0
    warnings: list[str] = field(default_factory=list)

    @property
    def contour_count(self) -> int:
        return len(self.contours)

    @property
    def point_count(self) -> int:
        return sum(len(c) for c in self.contours)


def process_gray(
    gray: NDArray[np.uint8], params: ProcessingParams, deadline: float | None = None
) -> ProcessingResult:
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

    _check_deadline(deadline)
    curves = _fit_curves(raw, params, width, height, deadline)
    fit = summarize(curves)
    if not curves and "no_contours" not in warnings:
        warnings.append("no_curves")

    return ProcessingResult(
        curves=curves,
        fit=fit,
        fit_tolerance_units=params.fit_tolerance * coordinates.unit_scale(width, height),
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


def _fit_curves(
    raw: list[contour_ops.PixelContour],
    params: ProcessingParams,
    width: int,
    height: int,
    deadline: float | None = None,
) -> list[FittedCurve]:
    """Fit lines, circles and Béziers to the dense (unsimplified) edge traces."""
    longest = max(width, height)
    min_extent = params.min_contour_size / 100.0 * longest

    kept: list[tuple[strokes.PixelPoints, bool]] = []
    for contour in raw:
        _check_deadline(deadline)
        for pts, closed in strokes.contour_to_strokes(contour):
            if strokes.stroke_extent(pts) >= max(min_extent, 1.0):
                kept.append((pts, closed))

    total = sum(len(pts) for pts, _ in kept)
    if total > MAX_FIT_POINTS:
        raise TooComplexError(total, MAX_FIT_POINTS)

    scale = coordinates.unit_scale(width, height)
    full_tolerance = params.fit_tolerance * scale
    tolerance = full_tolerance * FIT_JITTER_HEADROOM
    window = max(FIT_WINDOW_MIN_PX, FIT_WINDOW_FRACTION * longest) * scale
    curves = []
    segments = 0

    def check(fitting: int) -> None:
        _check_deadline(deadline)
        if segments + fitting > MAX_SEGMENTS:
            raise TooComplexError(segments + fitting, MAX_SEGMENTS)

    for pts, closed in kept:
        _check_deadline(deadline)
        cartesian = coordinates.image_to_cartesian(pts, width, height)
        curve = fit_stroke(
            cartesian, closed, tolerance, window, circle_tolerance=full_tolerance, progress=check
        )
        if curve.segments:
            curves.append(curve)
            segments += len(curve.segments)
            check(0)
    return curves


def process_image(
    data: bytes, params: ProcessingParams, deadline: float | None = None
) -> ProcessingResult:
    return process_gray(preprocess.decode_to_gray(data), params, deadline)


def edge_map_to_data_url(edge_map: NDArray[np.uint8]) -> str:
    """Encode edges as dark lines on a white background (a PNG data URL)."""
    ok, buf = cv2.imencode(".png", 255 - edge_map)
    if not ok:  # pragma: no cover - encoding a uint8 array does not fail
        raise RuntimeError("could not encode edge map")
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
