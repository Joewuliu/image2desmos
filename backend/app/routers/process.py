from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Form, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.processing import params as p
from app.processing.coordinates import unit_scale
from app.processing.pipeline import (
    TooComplexError,
    edge_map_to_data_url,
    process_image,
)
from app.fitting.types import FittedCurve, Segment
from app.schemas import (
    BoundsOut,
    CurveOut,
    FitStats,
    ProcessingParamsOut,
    ProcessingStats,
    ProcessResponse,
    SegmentOut,
)
from app.services.image_validation import ImageValidationError, validate_image
from app.services.upload_reader import read_limited

router = APIRouter(prefix="/api", tags=["process"])

_defaults = p.ProcessingParams()
COORD_DECIMALS = 4


def _segment_out(segment: Segment) -> SegmentOut:
    return SegmentOut(
        type=segment.type,
        points=[(x, y) for x, y in segment.points.round(COORD_DECIMALS).tolist()],
        center=(
            (round(segment.center[0], COORD_DECIMALS), round(segment.center[1], COORD_DECIMALS))
            if segment.center
            else None
        ),
        radius=round(segment.radius, COORD_DECIMALS) if segment.radius is not None else None,
        max_error=round(segment.max_error, 6),
    )


def _curve_out(curve: FittedCurve) -> CurveOut:
    return CurveOut(
        closed=curve.closed,
        segments=[_segment_out(s) for s in curve.segments],
        max_error=round(curve.max_error, 6),
        source_points=curve.source_points,
    )


@router.post("/process", response_model=ProcessResponse)
async def process(
    file: UploadFile,
    blur_sigma: Annotated[
        float, Form(ge=p.BLUR_SIGMA_RANGE[0], le=p.BLUR_SIGMA_RANGE[1])
    ] = _defaults.blur_sigma,
    edge_sensitivity: Annotated[
        float, Form(ge=p.SENSITIVITY_RANGE[0], le=p.SENSITIVITY_RANGE[1])
    ] = _defaults.edge_sensitivity,
    simplify: Annotated[
        float, Form(ge=p.SIMPLIFY_RANGE[0], le=p.SIMPLIFY_RANGE[1])
    ] = _defaults.simplify,
    fit_tolerance: Annotated[
        float, Form(ge=p.FIT_TOLERANCE_RANGE[0], le=p.FIT_TOLERANCE_RANGE[1])
    ] = _defaults.fit_tolerance,
    min_contour_size: Annotated[
        float, Form(ge=p.MIN_CONTOUR_SIZE_RANGE[0], le=p.MIN_CONTOUR_SIZE_RANGE[1])
    ] = _defaults.min_contour_size,
) -> ProcessResponse:
    """Extract simplified Cartesian contours from an uploaded PNG/JPEG.

    Uses the same validation and limits as ``/api/upload``. Nothing is stored.
    """
    data = await read_limited(file)
    metadata = validate_image(data, file.filename)
    params = p.ProcessingParams(
        blur_sigma, edge_sensitivity, simplify, fit_tolerance, min_contour_size
    )

    try:
        result = await run_in_threadpool(process_image, data, params)
    except TooComplexError as exc:
        raise ImageValidationError(
            "too_complex",
            "This image produces too much detail to fit. Lower the edge "
            "sensitivity, increase blur, simplification or minimum contour size, "
            "or use cleaner line art.",
            422,
        ) from exc

    unit = unit_scale(result.working_width, result.working_height)
    return ProcessResponse(
        image=metadata,
        params=ProcessingParamsOut(**asdict(params)),
        stats=ProcessingStats(
            contour_count=result.contour_count,
            point_count=result.point_count,
            edge_pixel_count=result.edge_pixel_count,
            canny_low=result.canny_low,
            canny_high=result.canny_high,
            blur_kernel=result.blur_kernel,
            epsilon_px=round(result.epsilon_px, 3),
            working_width=result.working_width,
            working_height=result.working_height,
        ),
        bounds=BoundsOut(**asdict(result.bounds)),
        contours=[
            [(x, y) for x, y in c.round(COORD_DECIMALS).tolist()] for c in result.contours
        ],
        curves=[_curve_out(c) for c in result.curves],
        fit=FitStats(
            curve_count=result.fit.curve_count,
            segment_count=result.fit.segment_count,
            line_count=result.fit.line_count,
            bezier_count=result.fit.bezier_count,
            circle_count=result.fit.circle_count,
            max_error=round(result.fit.max_error, 6),
            mean_error=round(result.fit.mean_error, 6),
            max_error_px=round(result.fit.max_error / unit, 3),
            mean_error_px=round(result.fit.mean_error / unit, 3),
            tolerance=round(result.fit_tolerance_units, 6),
            tolerance_px=params.fit_tolerance,
        ),
        edge_image=edge_map_to_data_url(result.edge_map),
        warnings=result.warnings,
    )
