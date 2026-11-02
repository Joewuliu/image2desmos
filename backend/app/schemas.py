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


class ProcessResponse(BaseModel):
    image: ImageMetadata
    params: ProcessingParamsOut
    stats: ProcessingStats
    bounds: BoundsOut
    # Each contour is a list of [x, y] Cartesian points (origin at the image
    # centre, y up). Contours are implicitly closed.
    contours: list[list[tuple[float, float]]]
    # PNG data URL: detected edges as dark lines on white.
    edge_image: str
    warnings: list[str]
