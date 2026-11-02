from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import upload
from app.services.image_validation import ImageValidationError

ALLOWED_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app = FastAPI(title="Image2Desmos API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(upload.router)


@app.exception_handler(ImageValidationError)
async def image_validation_handler(_: Request, exc: ImageValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_: Request, __: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"detail": {"code": "missing_file", "message": "No file was provided."}},
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
