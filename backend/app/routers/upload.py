from fastapi import APIRouter, UploadFile

from app.config import MAX_UPLOAD_BYTES, READ_CHUNK_BYTES
from app.schemas import ImageMetadata
from app.services.image_validation import ImageValidationError, validate_image

router = APIRouter(prefix="/api", tags=["upload"])


async def _read_limited(file: UploadFile) -> bytes:
    """Read the upload into memory, aborting as soon as the size limit is passed."""
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(READ_CHUNK_BYTES):
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise ImageValidationError(
                "file_too_large",
                f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
                413,
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/upload", response_model=ImageMetadata)
async def upload_image(file: UploadFile) -> ImageMetadata:
    """Validate an uploaded image and return its metadata.

    The file is held in memory only for the duration of the request and is
    never written to disk.
    """
    data = await _read_limited(file)
    return validate_image(data, file.filename)
