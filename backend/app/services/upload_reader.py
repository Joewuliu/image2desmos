from fastapi import UploadFile

from app.config import MAX_UPLOAD_BYTES, READ_CHUNK_BYTES
from app.services.image_validation import ImageValidationError


async def read_limited(file: UploadFile) -> bytes:
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
