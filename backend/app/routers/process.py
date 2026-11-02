from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Form, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.processing import params as p
from app.processing.pipeline import (
    TooComplexError,
    edge_map_to_data_url,
    process_image,
)
from app.schemas import (
    BoundsOut,
    ProcessingParamsOut,
    ProcessingStats,
    ProcessResponse,
)
from app.services.image_validation import ImageValidationError, validate_image
from app.services.upload_reader import read_limited

router = APIRouter(prefix="/api", tags=["process"])

_defaults = p.ProcessingParams()
COORD_DECIMALS = 4


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
) -> ProcessResponse:
    """Extract simplified Cartesian contours from an uploaded PNG/JPEG.

    Uses the same validation and limits as ``/api/upload``. Nothing is stored.
    """
    data = await read_limited(file)
    metadata = validate_image(data, file.filename)
    params = p.ProcessingParams(blur_sigma, edge_sensitivity, simplify)

    try:
        result = await run_in_threadpool(process_image, data, params)
    except TooComplexError as exc:
        raise ImageValidationError(
            "too_complex",
            "This image produces too many contour points. Lower the edge "
            "sensitivity, increase blur or simplification, or use cleaner line art.",
            422,
        ) from exc

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
        edge_image=edge_map_to_data_url(result.edge_map),
        warnings=result.warnings,
    )
