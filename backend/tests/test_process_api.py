import os

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests import synthetic

client = TestClient(app)


def post(data: bytes, name: str = "shape.png", ctype: str = "image/png", **fields: object):
    return client.post(
        "/api/process",
        files={"file": (name, data, ctype)},
        data={k: str(v) for k, v in fields.items()},
    )


def code(response) -> str:
    return response.json()["detail"]["code"]


def test_processes_square_and_returns_contours_and_metadata() -> None:
    response = post(synthetic.to_bytes(synthetic.square()))
    assert response.status_code == 200
    body = response.json()

    assert body["image"]["format"] == "PNG"
    assert body["stats"]["contour_count"] == len(body["contours"]) == 1
    assert body["stats"]["point_count"] == sum(len(c) for c in body["contours"])
    assert body["stats"]["canny_low"] < body["stats"]["canny_high"]
    assert body["bounds"] == {"min_x": -10.0, "max_x": 10.0, "min_y": -10.0, "max_y": 10.0}
    assert body["params"] == {
        "blur_sigma": 1.0,
        "edge_sensitivity": 50.0,
        "simplify": 2.0,
        "fit_tolerance": 1.0,
        "min_contour_size": 1.0,
    }
    assert body["edge_image"].startswith("data:image/png;base64,")
    assert body["warnings"] == []
    assert all(len(pt) == 2 for c in body["contours"] for pt in c)


def test_returns_curve_segments_with_errors_and_counts() -> None:
    body = post(synthetic.to_bytes(synthetic.circle_ring())).json()
    assert body["fit"]["circle_count"] == 2
    assert body["fit"]["segment_count"] == sum(len(c["segments"]) for c in body["curves"])
    assert body["fit"]["curve_count"] == len(body["curves"]) == 2
    assert 0 < body["fit"]["max_error_px"] <= body["fit"]["tolerance_px"]
    assert body["fit"]["mean_error"] <= body["fit"]["max_error"]
    seg = body["curves"][0]["segments"][0]
    assert seg["type"] == "circle" and seg["points"] == []
    assert seg["radius"] > 0 and len(seg["center"]) == 2 and seg["max_error"] >= 0


def test_square_curves_are_lines_and_beziers_with_control_points() -> None:
    body = post(synthetic.to_bytes(synthetic.square())).json()
    [curve] = body["curves"]
    assert curve["closed"] is True
    for seg in curve["segments"]:
        assert seg["type"] in {"line", "bezier"}
        assert len(seg["points"]) == (2 if seg["type"] == "line" else 4)
    first, last = curve["segments"][0]["points"][0], curve["segments"][-1]["points"][-1]
    assert first == last  # closed: no gap


def test_fit_parameters_are_applied() -> None:
    data = synthetic.to_bytes(synthetic.circle_ring())
    body = post(data, fit_tolerance=2.5, min_contour_size=7.5).json()
    assert body["params"]["fit_tolerance"] == 2.5
    assert body["params"]["min_contour_size"] == 7.5
    assert body["fit"]["tolerance_px"] == 2.5


def test_jpeg_is_supported() -> None:
    response = post(synthetic.to_bytes(synthetic.square(), "JPEG"), "a.jpg", "image/jpeg")
    assert response.status_code == 200
    assert response.json()["stats"]["contour_count"] >= 1


def test_parameters_are_applied() -> None:
    data = synthetic.to_bytes(synthetic.circle_ring())
    fine = post(data, simplify=0).json()
    coarse = post(data, simplify=8).json()
    assert fine["params"]["simplify"] == 0
    assert fine["stats"]["point_count"] > coarse["stats"]["point_count"]


def test_blank_image_succeeds_with_warning() -> None:
    response = post(synthetic.to_bytes(synthetic.blank()))
    assert response.status_code == 200
    body = response.json()
    assert body["contours"] == []
    assert body["warnings"] == ["no_contours"]


def test_noisy_image_fails_gracefully() -> None:
    from numpy import tile

    big_noise = tile(synthetic.noise(600), (3, 3))
    response = post(
        synthetic.to_bytes(big_noise), blur_sigma=0, edge_sensitivity=100, simplify=0
    )
    assert response.status_code == 422
    assert code(response) == "too_complex"


@pytest.mark.parametrize(
    "fields",
    [
        {"blur_sigma": -1},
        {"edge_sensitivity": 500},
        {"simplify": 99},
        {"simplify": "abc"},
        {"fit_tolerance": 0.1},
        {"min_contour_size": 50},
    ],
)
def test_out_of_range_parameters_are_rejected(fields: dict[str, object]) -> None:
    response = post(synthetic.to_bytes(synthetic.square()), **fields)
    assert response.status_code == 422
    assert code(response) == "invalid_parameter"


def test_reuses_upload_validation() -> None:
    assert code(post(b"not an image")) == "invalid_image"
    assert code(post(b"")) == "empty_file"
    assert post(b"not an image").status_code == 400

    gif = post(synthetic.to_bytes(synthetic.square(), "GIF"))
    assert gif.status_code == 415 and code(gif) == "unsupported_type"


def test_missing_file() -> None:
    response = client.post("/api/process")
    assert response.status_code == 422
    assert code(response) == "missing_file"


def test_reuses_size_limits(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.upload_reader.MAX_UPLOAD_BYTES", 1024)
    response = post(os.urandom(4096))
    assert response.status_code == 413 and code(response) == "file_too_large"

    monkeypatch.undo()
    monkeypatch.setattr("app.services.image_validation.MAX_IMAGE_PIXELS", 1000)
    response = post(synthetic.to_bytes(synthetic.square()))
    assert response.status_code == 413 and code(response) == "image_too_large"
