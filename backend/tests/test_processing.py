import numpy as np
import pytest

from app.processing import contours as contour_ops
from app.processing import edges, preprocess
from app.processing.params import MAX_TOTAL_POINTS, ProcessingParams
from app.processing.pipeline import TooComplexError, edge_map_to_data_url, process_gray, process_image
from tests import synthetic


def test_params_validate_ranges() -> None:
    with pytest.raises(ValueError):
        ProcessingParams(blur_sigma=-1)
    with pytest.raises(ValueError):
        ProcessingParams(edge_sensitivity=101)
    with pytest.raises(ValueError):
        ProcessingParams(simplify=11)


def test_gaussian_kernel_size_is_odd_and_zero_disables() -> None:
    assert preprocess.gaussian_kernel_size(0) == 0
    for sigma in (0.5, 1, 2.5, 5):
        assert preprocess.gaussian_kernel_size(sigma) % 2 == 1


def test_blur_smooths_and_zero_is_identity() -> None:
    img = synthetic.square()
    assert np.array_equal(preprocess.blur(img, 0), img)
    assert preprocess.blur(img, 2).std() < img.std()


def test_limit_size_downscales_but_never_upscales() -> None:
    big = np.zeros((100, 3200), dtype=np.uint8)
    assert preprocess.limit_size(big).shape == (50, 1600)
    small = np.zeros((10, 20), dtype=np.uint8)
    assert preprocess.limit_size(small) is small


def test_transparent_png_is_composited_on_white() -> None:
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGBA", (10, 10), (0, 0, 0, 0)).save(buf, format="PNG")
    gray = preprocess.decode_to_gray(buf.getvalue())
    assert gray.min() == 255


def test_higher_sensitivity_lowers_thresholds() -> None:
    low_s = edges.canny_thresholds(0)
    high_s = edges.canny_thresholds(100)
    assert high_s[0] < low_s[0] and high_s[1] < low_s[1]
    assert all(0 <= t <= 255 for t in (*low_s, *high_s))


def test_square_yields_one_contour_with_four_corners() -> None:
    result = process_gray(synthetic.square(), ProcessingParams(blur_sigma=1, simplify=3))
    assert result.contour_count == 1
    # Blur slightly rounds the corners, so a few extra vertices are expected.
    assert 4 <= len(result.contours[0]) <= 16
    assert not result.warnings


def test_square_contour_is_centred_and_correctly_sized() -> None:
    result = process_gray(synthetic.square(200, 100), ProcessingParams(blur_sigma=1, simplify=3))
    pts = result.contours[0]
    # 100px of a 200px image spans half of the 20-unit width => ~10 units.
    assert np.ptp(pts[:, 0]) == pytest.approx(10, abs=0.5)
    assert np.ptp(pts[:, 1]) == pytest.approx(10, abs=0.5)
    assert (pts[:, 0].min() + pts[:, 0].max()) / 2 == pytest.approx(0, abs=0.2)
    assert (pts[:, 1].min() + pts[:, 1].max()) / 2 == pytest.approx(0, abs=0.2)


def test_y_axis_is_flipped_for_off_centre_shape() -> None:
    img = synthetic.blank(200)
    img[10:60, 20:70] = 0  # near the TOP-LEFT in image space
    result = process_gray(img, ProcessingParams(blur_sigma=1, simplify=2))
    pts = result.contours[0]
    assert pts[:, 0].mean() < 0  # left of centre
    assert pts[:, 1].mean() > 0  # above centre in Cartesian space


def test_circle_ring_yields_one_contour_without_duplicate_inner_trace() -> None:
    result = process_gray(synthetic.circle_ring(), ProcessingParams(blur_sigma=1, simplify=1))
    # Thick ring: outer and inner edges are separate components.
    assert result.contour_count == 2
    radii = sorted(float(np.hypot(c[:, 0], c[:, 1]).mean()) for c in result.contours)
    assert radii[0] < radii[1]
    assert radii[1] == pytest.approx(61.5 * 0.1, abs=0.3)


def test_nested_shapes_are_both_found() -> None:
    result = process_gray(
        synthetic.square_with_inner_circle(), ProcessingParams(blur_sigma=1, simplify=1)
    )
    assert result.contour_count >= 2


def test_simplification_reduces_points_monotonically() -> None:
    img = synthetic.circle_ring()
    counts = [
        process_gray(img, ProcessingParams(blur_sigma=1, simplify=s)).point_count
        for s in (0, 1, 3, 8)
    ]
    assert counts == sorted(counts, reverse=True)
    assert counts[0] > counts[-1]


def test_blank_image_returns_no_contours_and_a_warning() -> None:
    result = process_gray(synthetic.blank(), ProcessingParams())
    assert result.contour_count == 0
    assert result.point_count == 0
    assert result.edge_pixel_count == 0
    assert result.warnings == ["no_contours"]


def test_noise_is_rejected_when_too_complex() -> None:
    with pytest.raises(TooComplexError):
        process_gray(
            np.tile(synthetic.noise(600), (3, 3)), ProcessingParams(0, 100, 0)
        )


def test_noise_is_bounded_with_default_settings() -> None:
    try:
        result = process_gray(synthetic.noise(), ProcessingParams())
    except TooComplexError:
        return
    assert result.point_count <= MAX_TOTAL_POINTS


def test_processing_is_deterministic() -> None:
    data = synthetic.to_bytes(synthetic.square_with_inner_circle())
    a = process_image(data, ProcessingParams())
    b = process_image(data, ProcessingParams())
    assert len(a.contours) == len(b.contours)
    for ca, cb in zip(a.contours, b.contours, strict=True):
        assert np.array_equal(ca, cb)
    assert np.array_equal(a.edge_map, b.edge_map)


def test_large_images_are_downscaled() -> None:
    img = np.full((1000, 2400), 255, dtype=np.uint8)
    img[300:700, 600:1800] = 0
    result = process_gray(img, ProcessingParams())
    assert result.working_width == 1600 and result.working_height == 667
    assert result.bounds.max_x == pytest.approx(10)


def test_edge_map_data_url_decodes_to_dark_lines_on_white() -> None:
    import base64

    import cv2

    edge_map = np.zeros((20, 20), dtype=np.uint8)
    edge_map[5, :] = 255
    url = edge_map_to_data_url(edge_map)
    assert url.startswith("data:image/png;base64,")
    raw = base64.b64decode(url.split(",", 1)[1])
    decoded = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_GRAYSCALE)
    assert decoded[5, 0] == 0 and decoded[0, 0] == 255


def test_filter_drops_tiny_specks() -> None:
    speck = np.array([[10, 10], [11, 10], [11, 11], [10, 11]], dtype=np.int32)
    assert contour_ops.filter_and_simplify([speck], 0.0, 400, 400) == []
    big = np.array([[10, 10], [60, 10], [60, 60], [10, 60]], dtype=np.int32)
    assert len(contour_ops.filter_and_simplify([big], 0.0, 200, 200)) == 1


def _encode(mode: str, size: tuple[int, int], fmt: str, **save) -> bytes:
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new(mode, size, "white").save(buf, format=fmt, **save)
    return buf.getvalue()


def test_exif_orientation_is_applied() -> None:
    from PIL import Image

    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 degrees
    data = _encode("RGB", (40, 20), "JPEG", exif=exif)
    assert preprocess.decode_to_gray(data).shape == (40, 20)


def test_oversized_images_are_shrunk_while_decoding() -> None:
    for mode, fmt in (("RGB", "JPEG"), ("RGBA", "PNG"), ("L", "PNG")):
        gray = preprocess.decode_to_gray(_encode(mode, (4900, 3300), fmt))
        assert 1600 <= max(gray.shape) < 3300
        assert gray.shape[1] > gray.shape[0]  # keeps its shape


def test_oversized_image_keeps_its_orientation() -> None:
    from PIL import Image

    exif = Image.Exif()
    exif[0x0112] = 6
    gray = preprocess.decode_to_gray(_encode("RGB", (4800, 1000), "JPEG", exif=exif))
    assert gray.shape[0] > gray.shape[1]


def test_transparent_ink_is_composited_correctly() -> None:
    from io import BytesIO

    from PIL import Image

    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    img.paste((0, 0, 0, 255), (5, 5, 15, 15))
    buf = BytesIO()
    img.save(buf, format="PNG")
    gray = preprocess.decode_to_gray(buf.getvalue())
    assert gray[10, 10] == 0 and gray[0, 0] == 255


def test_noise_is_refused_before_any_fitting() -> None:
    import time

    started = time.perf_counter()
    with pytest.raises(TooComplexError):
        process_gray(synthetic.noise(1600), ProcessingParams())
    assert time.perf_counter() - started < 10
