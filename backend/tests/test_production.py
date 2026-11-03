"""Behaviour that matters once the API is public."""

import asyncio
import importlib
import tempfile
import threading
import time
from io import BytesIO

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import config
from app.main import app
from app.processing.params import ProcessingParams
from app.processing.pipeline import ProcessingDeadlineError, process_gray
from app.routers import process as process_router
from app.services.job_limiter import (
    ClientGoneError,
    JobLimiter,
    JobTimeoutError,
    ServerBusyError,
)
from tests import synthetic

client = TestClient(app)
ORIGIN = {"Origin": "http://localhost:5173"}




def code(response) -> str:
    return response.json()["detail"]["code"]


def post_process(data: bytes):
    return client.post(
        "/api/process", headers=ORIGIN, files={"file": ("a.png", data, "image/png")}
    )


# ---- configuration --------------------------------------------------------


def test_origin_list_is_parsed_from_the_environment_format() -> None:
    assert config.parse_cors_origins(" https://a.vercel.app/ , http://localhost:5173,") == [
        "https://a.vercel.app",
        "http://localhost:5173",
    ]


def test_wildcard_origin_is_refused() -> None:
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        config.parse_cors_origins("https://a.app,*")


def test_settings_come_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://image2desmos.vercel.app")
    monkeypatch.setenv("JOB_TIMEOUT_SECONDS", "45")
    try:
        importlib.reload(config)
        assert config.CORS_ORIGINS == ["https://image2desmos.vercel.app"]
        assert config.JOB_TIMEOUT_SECONDS == 45
    finally:
        monkeypatch.undo()
        importlib.reload(config)
    assert "http://localhost:5173" in config.CORS_ORIGINS


def test_bad_numeric_setting_fails_at_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JOB_TIMEOUT_SECONDS", "0")
    try:
        with pytest.raises(ValueError, match="JOB_TIMEOUT_SECONDS"):
            importlib.reload(config)
    finally:
        monkeypatch.undo()
        importlib.reload(config)


def test_unlisted_origin_gets_no_cors_header() -> None:
    response = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers


# ---- request size ---------------------------------------------------------


def test_oversized_upload_is_refused_before_parsing_with_cors_headers() -> None:
    body = b"x" * (config.MAX_REQUEST_BYTES + 1)
    response = client.post(
        "/api/process",
        content=body,
        headers={**ORIGIN, "Content-Type": "multipart/form-data; boundary=x"},
    )
    assert response.status_code == 413
    assert code(response) == "file_too_large"
    assert response.headers["access-control-allow-origin"] == ORIGIN["Origin"]


def test_body_without_a_length_is_counted_as_it_arrives() -> None:
    def chunks():
        for _ in range(12):
            yield b"x" * (1024 * 1024)

    response = client.post(
        "/api/upload",
        content=chunks(),
        headers={**ORIGIN, "Content-Type": "multipart/form-data; boundary=x"},
    )
    assert response.status_code == 413
    assert code(response) == "file_too_large"
    assert response.headers["access-control-allow-origin"] == ORIGIN["Origin"]


def test_a_full_size_upload_still_passes_the_guard() -> None:
    # 9 MB of incompressible pixels: under the limit, so validation decides.
    side = 1800
    noise = np.random.default_rng(0).integers(0, 256, (side, side, 3), dtype=np.uint8)
    buf = BytesIO()
    Image.fromarray(noise).save(buf, format="PNG", compress_level=0)
    data = buf.getvalue()
    assert 9 * 1024 * 1024 < len(data) < config.MAX_UPLOAD_BYTES
    response = client.post("/api/upload", files={"file": ("big.png", data, "image/png")})
    assert response.status_code == 200


# ---- nothing on disk ------------------------------------------------------


def test_large_uploads_stay_in_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    rolled = []
    original = tempfile.SpooledTemporaryFile.rollover

    def spy(self):  # type: ignore[no-untyped-def]
        rolled.append(self)
        return original(self)

    monkeypatch.setattr(tempfile.SpooledTemporaryFile, "rollover", spy)
    side = 1200
    noise = np.random.default_rng(1).integers(0, 256, (side, side, 3), dtype=np.uint8)
    buf = BytesIO()
    Image.fromarray(noise).save(buf, format="PNG", compress_level=0)
    assert len(buf.getvalue()) > 2 * 1024 * 1024

    response = client.post("/api/upload", files={"file": ("n.png", buf.getvalue(), "image/png")})
    assert response.status_code == 200
    assert rolled == []


# ---- errors ---------------------------------------------------------------


def test_a_crash_becomes_readable_json_with_cors_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    def explode(*_args: object) -> None:
        raise RuntimeError("secret detail")

    monkeypatch.setattr(process_router, "process_image", explode)
    response = post_process(synthetic.to_bytes(synthetic.square()))
    assert response.status_code == 500
    assert code(response) == "server_error"
    assert "secret" not in response.text
    assert response.headers["access-control-allow-origin"] == ORIGIN["Origin"]


def test_out_of_memory_is_reported_the_same_way(monkeypatch: pytest.MonkeyPatch) -> None:
    def explode(*_args: object) -> None:
        raise MemoryError

    monkeypatch.setattr(process_router, "process_image", explode)
    response = post_process(synthetic.to_bytes(synthetic.square()))
    assert response.status_code == 500 and code(response) == "server_error"


def test_damaged_jpeg_data_is_reported_as_corrupt() -> None:
    noise = np.random.default_rng(2).integers(0, 256, (300, 300, 3), dtype=np.uint8)
    buf = BytesIO()
    Image.fromarray(noise).save(buf, format="JPEG")
    data = buf.getvalue()
    response = post_process(data[: len(data) // 2])
    assert response.status_code == 400
    assert code(response) == "corrupt_image"


def test_a_slow_trace_returns_504_and_frees_the_server(monkeypatch: pytest.MonkeyPatch) -> None:
    limiter = JobLimiter(1, 4, 5, 0.05)
    monkeypatch.setattr(process_router, "job_limiter", limiter)
    release = threading.Event()

    def slow(*_args: object) -> None:
        release.wait(0.3)
        raise ProcessingDeadlineError

    monkeypatch.setattr(process_router, "process_image", slow)
    response = post_process(synthetic.to_bytes(synthetic.square()))
    release.set()
    assert response.status_code == 504
    assert code(response) == "timeout"
    assert response.headers["access-control-allow-origin"] == ORIGIN["Origin"]


def test_the_deadline_stops_fitting_between_strokes() -> None:
    with pytest.raises(ProcessingDeadlineError):
        process_gray(synthetic.square(), ProcessingParams(), deadline=time.monotonic() - 1)


# ---- job limiter ----------------------------------------------------------


def test_jobs_run_one_at_a_time() -> None:
    active = 0
    peak = 0
    lock = threading.Lock()

    def job(_deadline: float) -> None:
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
        time.sleep(0.02)
        with lock:
            active -= 1

    async def main() -> None:
        limiter = JobLimiter(1, 8, 5, 5)

        async def gone() -> bool:
            return False

        await asyncio.gather(*(limiter.run(job, gone) for _ in range(5)))

    asyncio.run(main())
    assert peak == 1


def test_a_full_queue_is_refused_immediately() -> None:
    async def main() -> None:
        limiter = JobLimiter(1, 1, 5, 5)
        release = threading.Event()

        async def gone() -> bool:
            return False

        first = asyncio.create_task(limiter.run(lambda _: release.wait(2), gone))
        await asyncio.sleep(0.01)
        queued = asyncio.create_task(limiter.run(lambda _: None, gone))
        await asyncio.sleep(0.01)
        with pytest.raises(ServerBusyError):
            await limiter.run(lambda _: None, gone)
        release.set()
        await asyncio.gather(first, queued)

    asyncio.run(main())


def test_a_long_wait_gives_up_as_busy() -> None:
    async def main() -> None:
        limiter = JobLimiter(1, 4, 0.1, 5)
        release = threading.Event()

        async def gone() -> bool:
            return False

        first = asyncio.create_task(limiter.run(lambda _: release.wait(3), gone))
        await asyncio.sleep(0.01)
        with pytest.raises(ServerBusyError):
            await limiter.run(lambda _: None, gone)
        release.set()
        await first

    asyncio.run(main())


def test_abandoned_requests_never_run() -> None:
    ran = []

    async def main() -> None:
        limiter = JobLimiter(1, 4, 5, 5)
        release = threading.Event()

        async def here() -> bool:
            return False

        async def left() -> bool:
            return True

        first = asyncio.create_task(limiter.run(lambda _: release.wait(3), here))
        await asyncio.sleep(0.01)
        with pytest.raises(ClientGoneError):
            await limiter.run(lambda _: ran.append(1), left)
        release.set()
        await first

    asyncio.run(main())
    assert ran == []


def test_a_timed_out_job_keeps_its_slot_until_it_really_stops() -> None:
    async def main() -> None:
        limiter = JobLimiter(1, 4, 0.1, 0.01)
        release = threading.Event()

        async def gone() -> bool:
            return False

        with pytest.raises(JobTimeoutError):
            await limiter.run(lambda _: release.wait(3), gone)
        with pytest.raises(ServerBusyError):
            await limiter.run(lambda _: None, gone)  # the thread is still running

        release.set()
        await asyncio.sleep(0.05)
        limiter._timeout_seconds = 5
        assert await limiter.run(lambda _: "free again", gone) == "free again"

    asyncio.run(main())
