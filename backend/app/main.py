from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.formparsers import MultiPartParser

from app import config
from app.middleware import RequestGuardMiddleware
from app.routers import process, upload
from app.services.image_validation import ImageValidationError
from app.services.job_limiter import ClientGoneError, JobTimeoutError, ServerBusyError

# Starlette spills uploads over 1 MB to a temp file. Images stay in memory here:
# they are never written to disk, and the request guard caps how large they get.
MultiPartParser.spool_max_size = config.MAX_REQUEST_BYTES + 1

app = FastAPI(title="Image2Desmos API", version="0.1.0")

# Added first, so it sits inside CORS and its refusals carry CORS headers.
app.add_middleware(
    RequestGuardMiddleware,
    max_body_bytes=config.MAX_REQUEST_BYTES,
    too_large_message=f"File exceeds the {config.MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_origin_regex=config.CORS_ORIGIN_REGEX,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(process.router)


@app.exception_handler(ImageValidationError)
async def image_validation_handler(_: Request, exc: ImageValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": {"code": exc.code, "message": exc.message}},
    )


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": {"code": code, "message": message}})


@app.exception_handler(ServerBusyError)
async def busy_handler(_: Request, __: ServerBusyError) -> JSONResponse:
    return _error(503, "busy", "Image2Desmos is busy right now. Please try again in a moment.")


@app.exception_handler(JobTimeoutError)
async def timeout_handler(_: Request, __: JobTimeoutError) -> JSONResponse:
    return _error(
        504,
        "timeout",
        "This image took too long to trace. Try lowering edge sensitivity, "
        "or raising blur or simplification.",
    )


@app.exception_handler(ClientGoneError)
async def client_gone_handler(_: Request, __: ClientGoneError) -> Response:
    return Response(status_code=499)


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    fields = {str(err["loc"][1]) for err in exc.errors() if len(err["loc"]) > 1}
    if "file" in fields or not fields:
        code, message = "missing_file", "No file was provided."
    else:
        code = "invalid_parameter"
        message = f"Invalid value for: {', '.join(sorted(fields))}."
    return JSONResponse(status_code=422, content={"detail": {"code": code, "message": message}})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
