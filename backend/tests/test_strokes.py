import cv2
import numpy as np

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
    # A "T" traced out-and-back along every branch.
    stem = [[5, y] for y in range(5, -1, -1)]
    left = [[x, 0] for x in range(4, -1, -1)]
    right = [[x, 0] for x in range(6, 11)]
    trace = stem + left + left[-2::-1] + right + right[-2::-1] + stem[-2::-1][::-1][::-1]
    strokes = contour_to_strokes(np.array(trace, dtype=np.int32))
    assert strokes and all(not closed for _, closed in strokes)


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
