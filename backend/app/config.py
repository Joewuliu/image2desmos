import os

MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
MAX_IMAGE_PIXELS: int = 25_000_000
READ_CHUNK_BYTES: int = 64 * 1024
# Multipart framing and the form fields around the file.
MAX_REQUEST_BYTES: int = MAX_UPLOAD_BYTES + 64 * 1024

ALLOWED_FORMATS: dict[str, str] = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
}

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def parse_cors_origins(raw: str) -> list[str]:
    """Split a comma-separated origin list; a wildcard is refused outright."""
    origins = [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]
    if "*" in origins:
        raise ValueError("CORS_ORIGINS must list exact origins, not '*'")
    return origins


def _positive_number(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    value = float(raw)
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero")
    return value


CORS_ORIGINS: list[str] = parse_cors_origins(os.environ.get("CORS_ORIGINS") or DEFAULT_CORS_ORIGINS)
# Optional, for preview deployments, e.g. https://image2desmos-.*\.vercel\.app
CORS_ORIGIN_REGEX: str | None = os.environ.get("CORS_ORIGIN_REGEX", "").strip() or None

# Tracing is CPU-bound and each job holds an image in memory, so a small
# instance runs one at a time and keeps only a short queue.
MAX_CONCURRENT_JOBS: int = int(_positive_number("MAX_CONCURRENT_JOBS", 1))
MAX_QUEUED_JOBS: int = int(_positive_number("MAX_QUEUED_JOBS", 4))
JOB_QUEUE_SECONDS: float = _positive_number("JOB_QUEUE_SECONDS", 30)
JOB_TIMEOUT_SECONDS: float = _positive_number("JOB_TIMEOUT_SECONDS", 60)
