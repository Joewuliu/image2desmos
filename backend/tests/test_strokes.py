import cv2
import numpy as np
import pytest

from app.processing import contours as contour_ops
from app.processing import edges, preprocess
from app.processing.params import ProcessingParams
from app.processing.pipeline import process_gray
from app.processing.strokes import contour_to_strokes, stroke_extent
from tests import synthetic


def test_closed_loop_is_closed() -> None:
    ring = (
        [[x, 0] for x in range(10)]
        + [[9, y] for y in range(1, 10)]
        + [[x, 9] for x in range(8, -1, -1)]
        + [[0, y] for y in range(8, 0, -1)]
    )
    loop = np.array(ring, dtype=np.int32)
    [(pts, closed)] = contour_to_strokes(loop)
    assert closed and len(pts) == len(loop)


def test_out_and_back_trace_becomes_one_open_stroke() -> None:
    forward = [[x, 5] for x in range(0, 11)]
    trace = np.array(forward + forward[-2:0:-1], dtype=np.int32)
    [(pts, closed)] = contour_to_strokes(trace)
    assert not closed
    assert pts[0].tolist() == [0, 5] and pts[-1].tolist() == [10, 5]
    assert len(pts) == 11


def test_branching_trace_yields_open_strokes_only() -> None:
    # A real "T" of one-pixel edges, as OpenCV traces it.
    edge_map = np.zeros((100, 100), dtype=np.uint8)
    cv2.line(edge_map, (10, 20), (90, 20), 255, 1)
    cv2.line(edge_map, (50, 20), (50, 90), 255, 1)
    strokes = [s for t in contour_ops.extract_contours(edge_map) for s in contour_to_strokes(t)]
    assert len(strokes) == 3 or len(strokes) == 2
    assert all(not closed for _, closed in strokes)
    assert max(stroke_extent(pts) for pts, _ in strokes) >= 70
    assert sum(len(pts) for pts, _ in strokes) >= 140  # the bar and the stem are both there


def _traces(edge_map: np.ndarray) -> list[np.ndarray]:
    return contour_ops.extract_contours(edge_map)


def test_diagonal_edge_is_one_stroke_not_fragments() -> None:
    # Staircase pixels are visited once per walk; they must not read as stroke ends.
    edge_map = np.zeros((300, 300), dtype=np.uint8)
    cv2.polylines(edge_map, [np.array([[20, 280], [150, 30], [280, 250]], np.int32)], False, 255, 1)

    [(pts, closed)] = [s for t in _traces(edge_map) for s in contour_to_strokes(t)]
    assert not closed
    assert stroke_extent(pts) >= 250


def test_small_gap_in_a_loop_is_closed_again() -> None:
    edge_map = np.zeros((200, 200), dtype=np.uint8)
    cv2.circle(edge_map, (100, 100), 70, 255, 1)
    edge_map[28:32, 98:101] = 0

    strokes = [s for t in _traces(edge_map) for s in contour_to_strokes(t)]
    assert len(strokes) == 1
    pts, closed = strokes[0]
    assert closed
    assert len(pts) > 300


@pytest.mark.parametrize("blur", [0.5, 1.0, 1.5, 2.0, 3.0])
def test_curves_keep_the_whole_outline_at_every_blur(blur: float) -> None:
    # Outlines must not lose edges when Canny happens to leave a small gap.
    img = synthetic.blank(600)
    triangle = np.array([[300, 60], [520, 500], [90, 470]], np.int32)
    cv2.fillPoly(img, [triangle], 0, cv2.LINE_AA)
    result = process_gray(img, ProcessingParams(blur_sigma=blur))
    # Heavy blur can split the inner and outer edge, which is still a complete outline.
    assert 1 <= len(result.curves) <= 3
    # Diagonal traces skip corner pixels, so about 3 in 4 edge pixels is a full outline.
    assert sum(c.source_points for c in result.curves) >= 0.7 * result.edge_pixel_count


def test_tiny_inputs() -> None:
    assert contour_to_strokes(np.zeros((1, 2), dtype=np.int32)) == []
    [(pts, closed)] = contour_to_strokes(np.array([[0, 0], [1, 1]], dtype=np.int32))
    assert not closed and len(pts) == 2


def test_stroke_extent() -> None:
    assert stroke_extent(np.array([[2, 3], [12, 5]], dtype=np.int32)) == 10
    assert stroke_extent(np.empty((0, 2), dtype=np.int32)) == 0


def test_real_edge_traces_of_a_filled_shape_are_closed() -> None:
    edge_map, _, _ = edges.detect_edges(preprocess.blur(synthetic.square(), 1.0), 50)
    traces = contour_ops.extract_contours(edge_map)
    strokes = [s for t in traces for s in contour_to_strokes(t)]
    assert strokes and all(closed for _, closed in strokes)


def test_pipeline_curves_for_square_are_closed_and_connected() -> None:
    result = process_gray(synthetic.square(), ProcessingParams())
    assert len(result.curves) == 1 and result.curves[0].closed
    segs = result.curves[0].segments
    for a, b in zip(segs, segs[1:] + segs[:1], strict=True):
        assert np.allclose(a.end, b.start)
    assert result.fit.max_error / (20 / 200) <= 1.0  # within the 1 px tolerance


def test_pipeline_finds_circles_in_a_ring() -> None:
    result = process_gray(synthetic.circle_ring(), ProcessingParams())
    assert result.fit.circle_count == 2
    radii = sorted(c.segments[0].radius for c in result.curves)
    assert radii[0] < radii[1]
    assert abs(radii[1] - 6.15) < 0.15  # outer edge of a 60 px radius, 3 px thick ring
    # Centred on the origin, in the same Cartesian space as the contours.
    for c in result.curves:
        assert np.allclose(c.segments[0].center, (0, 0), atol=0.15)


def test_pipeline_curves_share_coordinates_with_contours() -> None:
    result = process_gray(synthetic.square(), ProcessingParams())
    pts = np.vstack([s.points for c in result.curves for s in c.segments])
    contour = np.vstack(result.contours)
    assert np.allclose(pts.min(axis=0), contour.min(axis=0), atol=0.3)
    assert np.allclose(pts.max(axis=0), contour.max(axis=0), atol=0.3)


def test_min_contour_size_filters_small_shapes() -> None:
    img = synthetic.blank(400)
    cv2.rectangle(img, (50, 50), (250, 250), 0, 3)  # large
    cv2.circle(img, (330, 330), 6, 0, 2)  # tiny: about 3 % of the image
    keep_all = process_gray(img, ProcessingParams(min_contour_size=0))
    filtered = process_gray(img, ProcessingParams(min_contour_size=10))
    assert len(filtered.curves) < len(keep_all.curves)
    assert len(filtered.curves) >= 1


def test_fit_tolerance_changes_segment_count() -> None:
    img = synthetic.blank(400)
    pts = np.array([[20 + i * 15, 200 + int(80 * np.sin(i / 3))] for i in range(25)], np.int32)
    cv2.polylines(img, [pts], False, 0, 3)
    tight = process_gray(img, ProcessingParams(fit_tolerance=0.5, simplify=0))
    loose = process_gray(img, ProcessingParams(fit_tolerance=5, simplify=0))
    assert tight.fit.segment_count > loose.fit.segment_count


def test_blank_image_has_no_curves() -> None:
    result = process_gray(synthetic.blank(), ProcessingParams())
    assert result.curves == [] and result.fit.segment_count == 0
