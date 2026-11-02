import os
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import config
from app.main import app

client = TestClient(app)


def make_image(fmt: str, size: tuple[int, int] = (40, 30), mode: str = "RGB") -> bytes:
    buf = BytesIO()
    Image.new(mode, size, "white").save(buf, format=fmt)
    return buf.getvalue()


def post(data: bytes, name: str = "art.png", content_type: str = "image/png"):
    return client.post("/api/upload", files={"file": (name, data, content_type)})


def error_code(response) -> str:
    return response.json()["detail"]["code"]


def test_png_upload_returns_metadata() -> None:
    data = make_image("PNG")
    response = post(data)
    assert response.status_code == 200
    assert response.json() == {
        "filename": "art.png",
        "format": "PNG",
        "mime_type": "image/png",
        "width": 40,
        "height": 30,
        "pixel_count": 1200,
        "size_bytes": len(data),
        "has_alpha": False,
    }


def test_jpeg_upload_returns_metadata() -> None:
    response = post(make_image("JPEG"), "photo.jpg", "image/jpeg")
    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "JPEG"
    assert body["mime_type"] == "image/jpeg"


def test_png_with_alpha_is_detected() -> None:
    response = post(make_image("PNG", mode="RGBA"))
    assert response.json()["has_alpha"] is True


def test_content_wins_over_declared_type_and_extension() -> None:
    response = post(make_image("JPEG"), "mislabelled.png", "image/png")
    assert response.status_code == 200
    assert response.json()["format"] == "JPEG"


def test_text_file_with_image_extension_is_rejected() -> None:
    response = post(b"definitely not an image", "fake.png")
    assert response.status_code == 400
    assert error_code(response) == "invalid_image"


def test_unsupported_real_image_format_is_rejected() -> None:
    response = post(make_image("GIF"), "anim.png")
    assert response.status_code == 415
    assert error_code(response) == "unsupported_type"


def test_truncated_image_is_rejected() -> None:
    data = make_image("PNG", (200, 200))
    response = post(data[: len(data) // 2])
    assert response.status_code == 400
    assert error_code(response) in {"corrupt_image", "invalid_image"}


def test_empty_file_is_rejected() -> None:
    response = post(b"")
    assert response.status_code == 400
    assert error_code(response) == "empty_file"


def test_missing_file_field_is_rejected() -> None:
    response = client.post("/api/upload")
    assert response.status_code == 422
    assert error_code(response) == "missing_file"


def test_oversized_file_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.upload_reader.MAX_UPLOAD_BYTES", 1024)
    response = post(os.urandom(4096))
    assert response.status_code == 413
    assert error_code(response) == "file_too_large"


def test_file_exactly_at_limit_passes_size_check(monkeypatch: pytest.MonkeyPatch) -> None:
    data = make_image("PNG")
    monkeypatch.setattr("app.services.upload_reader.MAX_UPLOAD_BYTES", len(data))
    monkeypatch.setattr("app.services.image_validation.MAX_UPLOAD_BYTES", len(data))
    assert post(data).status_code == 200


def test_pixel_limit_is_enforced(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.image_validation.MAX_IMAGE_PIXELS", 1000)
    response = post(make_image("PNG", (40, 30)))
    assert response.status_code == 413
    assert error_code(response) == "image_too_large"


def test_filename_is_sanitised() -> None:
    response = post(make_image("PNG"), "../../etc/passwd.png")
    assert response.json()["filename"] == "passwd.png"


def test_upload_is_not_written_to_disk(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    assert post(make_image("PNG")).status_code == 200
    assert list(tmp_path.iterdir()) == []


def test_limits_are_as_specified() -> None:
    assert config.MAX_UPLOAD_BYTES == 10 * 1024 * 1024
    assert config.MAX_IMAGE_PIXELS == 25_000_000
