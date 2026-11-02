from typing import Literal

from pydantic import BaseModel


class ImageMetadata(BaseModel):
    filename: str
    format: str
    mime_type: str
    width: int
    height: int
    pixel_count: int
    size_bytes: int
    has_alpha: bool


class ProcessingParamsOut(BaseModel):
    blur_sigma: float
    edge_sensitivity: float
    simplify: float
    fit_tolerance: float
    min_contour_size: float


class ProcessingStats(BaseModel):
    contour_count: int
    point_count: int
    edge_pixel_count: int
    canny_low: int
    canny_high: int
    blur_kernel: int
    epsilon_px: float
    working_width: int
    working_height: int


class BoundsOut(BaseModel):
    min_x: float
    max_x: float
    min_y: float
    max_y: float


class SegmentOut(BaseModel):
    """One fitted piece, in the same Cartesian space as ``contours``.

    line:   points = [start, end]
    bezier: points = [start, control1, control2, end] (cubic)
    circle: center and radius set, points empty
    """

    type: Literal["line", "bezier", "circle"]
    points: list[tuple[float, float]]
    center: tuple[float, float] | None = None
    radius: float | None = None
    max_error: float


class CurveOut(BaseModel):
    closed: bool
    segments: list[SegmentOut]
    max_error: float
    source_points: int


class FitStats(BaseModel):
    curve_count: int
    segment_count: int
    line_count: int
    bezier_count: int
    circle_count: int
    # Distances from the traced outline to the fitted curves, in Cartesian
    # units and in working-image pixels.
    max_error: float
    mean_error: float
    max_error_px: float
    mean_error_px: float
    tolerance: float
    tolerance_px: float


class ExpressionOut(BaseModel):
    """One Desmos expression. ``id`` is a valid Desmos expression id."""

    id: str
    latex: str
    type: Literal["line", "bezier", "circle"]
    curve: int
    segment: int


class DesmosOut(BaseModel):
    expressions: list[ExpressionOut]
    count: int
    # Segments that could not be written as valid expressions, by reason
    # ("degenerate" or "invalid_geometry").
    skipped: dict[str, int]
    skipped_count: int


class ProcessResponse(BaseModel):
    image: ImageMetadata
    params: ProcessingParamsOut
    stats: ProcessingStats
    bounds: BoundsOut
    # Each contour is a list of [x, y] Cartesian points (origin at the image
    # centre, y up). Contours are implicitly closed.
    contours: list[list[tuple[float, float]]]
    # Fitted curves (lines, circles, cubic Béziers), one entry per stroke.
    curves: list[CurveOut]
    fit: FitStats
    desmos: DesmosOut
    # PNG data URL: detected edges as dark lines on white.
    edge_image: str
    warnings: list[str]
