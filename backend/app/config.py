MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
MAX_IMAGE_PIXELS: int = 25_000_000
READ_CHUNK_BYTES: int = 64 * 1024

ALLOWED_FORMATS: dict[str, str] = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
}
