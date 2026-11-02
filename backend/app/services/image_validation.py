"""Content-based validation of uploaded images.

The client-supplied filename and Content-Type are never trusted; the format is
determined from the file's own bytes. Dimensions are read from the header and
checked before any pixel data is decoded, which guards against decompression
bombs.
"""

import warnings
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from app.config import ALLOWED_FORMATS, MAX_IMAGE_PIXELS, MAX_UPLOAD_BYTES
from app.schemas import ImageMetadata

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class ImageValidationError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def sanitize_filename(name: str | None) -> str:
    base = (name or "").replace("\\", "/").rsplit("/", 1)[-1]
    cleaned = "".join(ch for ch in base if ch.isprintable()).strip()
    return cleaned[:120] or "image"


def validate_image(data: bytes, filename: str | None) -> ImageMetadata:
    if not data:
        raise ImageValidationError("empty_file", "The uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ImageValidationError(
            "file_too_large",
            f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
            413,
        )

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as img:
                fmt = img.format or ""
                width, height = img.size
                has_alpha = "A" in img.getbands() or "transparency" in img.info
                if fmt not in ALLOWED_FORMATS:
                    raise ImageValidationError(
                        "unsupported_type",
                        "Only PNG and JPEG images are supported.",
                        415,
                    )
                if width * height > MAX_IMAGE_PIXELS:
                    raise ImageValidationError(
                        "image_too_large",
                        f"Image exceeds the {MAX_IMAGE_PIXELS // 1_000_000} megapixel limit.",
                        413,
                    )
                img.verify()
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ImageValidationError(
            "invalid_image", "The file is not a valid PNG or JPEG image."
        ) from None
    except (OSError, SyntaxError, ValueError):
        raise ImageValidationError(
            "corrupt_image", "The image file appears to be corrupt."
        ) from None

    return ImageMetadata(
        filename=sanitize_filename(filename),
        format=fmt,
        mime_type=ALLOWED_FORMATS[fmt],
        width=width,
        height=height,
        pixel_count=width * height,
        size_bytes=len(data),
        has_alpha=has_alpha,
    )
