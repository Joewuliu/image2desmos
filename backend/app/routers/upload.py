from fastapi import APIRouter, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.schemas import ImageMetadata
from app.services.image_validation import validate_image
from app.services.upload_reader import read_limited

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload", response_model=ImageMetadata)
async def upload_image(file: UploadFile) -> ImageMetadata:
    """Validate an uploaded image and return its metadata.

    The file is held in memory only for the duration of the request and is
    never written to disk.
    """
    data = await read_limited(file)
    return await run_in_threadpool(validate_image, data, file.filename)
