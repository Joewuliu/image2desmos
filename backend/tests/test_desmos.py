"""Desmos serialization.

Expressions are checked two ways: exact text for simple cases, and by
evaluating the generated LaTeX independently of the serializer and comparing
it with the geometry it came from.
"""

import re

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.desmos import latex
from app.desmos.serializer import (
    bezier_latex,
    circle_latex,
    line_latex,
    segment_latex,
    serialize_curves,
)
from app.fitting.bezier import bezier_points
from app.fitting.fitter import fit_stroke
from app.fitting.types import FittedCurve, Segment
from app.main import app
from tests import synthetic

T = np.linspace(0, 1, 41)
PARAMETRIC = re.compile(r"\\left\((?P<x>[^,]+),(?P<y>[^,]+)\\right\)\\left\\\{0\\le t\\le1\\right\\\}")


def _py(expr: str) -> str:
    expr = expr.replace(r"\left", "").replace(r"\right", "")
    expr = re.sub(r"(?<=[\d)])(?=[tx(y])", "*", expr)  # implicit multiplication
    expr = re.sub(r"(?<=[ty])(?=\()", "*", expr)
    return expr.replace("^", "**")


def eval_parametric(text: str, t: np.ndarray = T) -> np.ndarray:
    match = PARAMETRIC.fullmatch(text)
    assert match, f"not a restricted parametric expression: {text}"
    return np.c_[eval(_py(match["x"]), {"t": t}) * np.ones_like(t), eval(_py(match["y"]), {"t": t}) * np.ones_like(t)]  # noqa: S307


def circle_residual(text: str, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    lhs, rhs = text.split("=")
    env = {"x": x, "y": y}
    return eval(_py(lhs), env) - eval(_py(rhs), env)  # noqa: S307


def segment(kind: str, points=None, center=None, radius=None) -> Segment:
    pts = np.empty((0, 2)) if points is None else np.array(points, dtype=float)
    return Segment(kind, pts, 0.0, center=center, radius=radius)  # type: ignore[arg-type]


# ---- number / polynomial formatting --------------------------------------


@pytest.mark.parametrize(
    ("value", "text"),
    [(0, "0"), (-0.0, "0"), (1.5, "1.5"), (2.0, "2"), (-3.25, "-3.25"), (1e-9, "0"),
     (-1e-9, "0"), (0.123456789, "0.12346"), (1234.5, "1234.5"), (1e7, "10000000")],
)
def test_number_formatting(value: float, text: str) -> None:
    assert latex.number(value) == text


def test_polynomial_formatting() -> None:
    assert latex.polynomial([4, -1, 2, -1.5]) == "-1.5t^3+2t^2-t+4"
    assert latex.polynomial([0, 1]) == "t"
    assert latex.polynomial([0, 0, -1]) == "-t^2"
    assert latex.polynomial([-2, 0, 3]) == "3t^2-2"
    assert latex.polynomial([0, 0, 0, 0]) == "0"
    assert latex.polynomial([1e-9, 0]) == "0"


# ---- lines ----------------------------------------------------------------


def test_line_exact_text() -> None:
    out = line_latex(np.array([1.0, 2.0]), np.array([4.0, -2.0]))
    assert out == r"\left(3t+1,-4t+2\right)\left\{0\le t\le1\right\}"


def test_line_hits_both_end_points_and_stays_on_segment() -> None:
    p0, p1 = np.array([-3.5, 0.25]), np.array([6.0, -7.75])
    pts = eval_parametric(line_latex(p0, p1))  # type: ignore[arg-type]
    assert pts[0] == pytest.approx(p0, abs=1e-4) and pts[-1] == pytest.approx(p1, abs=1e-4)
    mid = eval_parametric(line_latex(p0, p1), np.array([0.5]))[0]  # type: ignore[arg-type]
    assert mid == pytest.approx((p0 + p1) / 2, abs=1e-4)


def test_horizontal_and_vertical_lines_drop_zero_terms() -> None:
    assert line_latex(np.array([0.0, 5.0]), np.array([2.0, 5.0])) == (
        r"\left(2t,5\right)\left\{0\le t\le1\right\}"
    )
    assert line_latex(np.array([3.0, 0.0]), np.array([3.0, -2.0])) == (
        r"\left(3,-2t\right)\left\{0\le t\le1\right\}"
    )


def test_zero_length_line_is_degenerate() -> None:
    assert line_latex(np.array([1.0, 1.0]), np.array([1.0, 1.0])) == "degenerate"
    assert line_latex(np.array([1.0, 1.0]), np.array([1.0000001, 1.0])) == "degenerate"


def test_non_finite_line_is_invalid() -> None:
    assert line_latex(np.array([np.nan, 0.0]), np.array([1.0, 1.0])) == "invalid_geometry"
    assert line_latex(np.array([0.0, 0.0]), np.array([np.inf, 1.0])) == "invalid_geometry"


# ---- Béziers --------------------------------------------------------------


def test_bezier_matches_the_curve_it_came_from() -> None:
    ctrl = np.array([[-4.0, 1.0], [-1.0, 6.5], [3.0, -5.0], [5.5, 2.25]])
    got = eval_parametric(bezier_latex(ctrl))  # type: ignore[arg-type]
    assert got == pytest.approx(bezier_points(ctrl, T), abs=1e-3)
    assert got[0] == pytest.approx(ctrl[0], abs=1e-4) and got[-1] == pytest.approx(ctrl[3], abs=1e-4)


def test_bezier_exact_text() -> None:
    ctrl = np.array([[0.0, 0.0], [1.0, 2.0], [2.0, 2.0], [3.0, 0.0]])
    # x(t) = 3t (control points evenly spaced), y(t) = 6t - 6t^2
    assert bezier_latex(ctrl) == r"\left(3t,-6t^2+6t\right)\left\{0\le t\le1\right\}"


def test_bezier_with_collinear_controls_is_still_valid() -> None:
    ctrl = np.array([[0.0, 0.0], [1.0, 1.0], [2.0, 2.0], [5.0, 5.0]])
    got = eval_parametric(bezier_latex(ctrl))  # type: ignore[arg-type]
    assert got == pytest.approx(bezier_points(ctrl, T), abs=1e-3)


def test_bezier_with_all_points_equal_is_degenerate() -> None:
    assert bezier_latex(np.full((4, 2), 2.5)) == "degenerate"


def test_bezier_with_bad_shape_or_values_is_invalid() -> None:
    assert bezier_latex(np.zeros((3, 2))) == "invalid_geometry"
    bad = np.array([[0.0, 0.0], [1.0, np.nan], [2.0, 2.0], [3.0, 0.0]])
    assert bezier_latex(bad) == "invalid_geometry"


def test_bezier_coefficient_rounding_is_far_below_a_pixel() -> None:
    rng = np.random.default_rng(7)
    for _ in range(25):
        ctrl = rng.uniform(-10, 10, size=(4, 2))
        got = eval_parametric(bezier_latex(ctrl))  # type: ignore[arg-type]
        assert np.abs(got - bezier_points(ctrl, T)).max() < 1e-3  # 20-unit canvas


# ---- circles --------------------------------------------------------------


def test_circle_exact_text() -> None:
    assert circle_latex((1.0, -2.0), 3.0) == r"\left(x-1\right)^2+\left(y+2\right)^2=3^2"
    assert circle_latex((0.0, 0.0), 2.5) == r"x^2+y^2=2.5^2"
    assert circle_latex((-0.5, 0.0), 1.0) == r"\left(x+0.5\right)^2+y^2=1^2"


def test_circle_equation_is_satisfied_by_points_on_the_circle() -> None:
    cx, cy, r = -1.75, 3.5, 4.25
    text = circle_latex((cx, cy), r)
    assert isinstance(text, str)
    a = np.linspace(0, 2 * np.pi, 50)
    on = circle_residual(text, cx + r * np.cos(a), cy + r * np.sin(a))
    off = circle_residual(text, np.array([cx + 2 * r]), np.array([cy]))
    assert np.abs(on).max() < 1e-6
    assert abs(off[0]) > 1


def test_degenerate_circles() -> None:
    assert circle_latex((0.0, 0.0), 0.0) == "degenerate"
    assert circle_latex((0.0, 0.0), -1.0) == "degenerate"
    assert circle_latex((0.0, 0.0), 1e-9) == "degenerate"
    assert circle_latex(None, 1.0) == "invalid_geometry"
    assert circle_latex((0.0, 0.0), None) == "invalid_geometry"
    assert circle_latex((np.inf, 0.0), 1.0) == "invalid_geometry"
    assert circle_latex((0.0, 0.0), float("nan")) == "invalid_geometry"


# ---- whole curves ---------------------------------------------------------


def test_serialize_mixed_curves_in_order_with_ids_and_types() -> None:
    curves = [
        FittedCurve(True, [segment("circle", center=(0.0, 0.0), radius=2.0)], 30),
        FittedCurve(
            False,
            [
                segment("line", [[0, 0], [1, 1]]),
                segment("bezier", [[1, 1], [2, 3], [3, 3], [4, 1]]),
            ],
            50,
        ),
    ]
    graph = serialize_curves(curves)
    assert [e.type for e in graph.expressions] == ["circle", "line", "bezier"]
    assert [e.id for e in graph.expressions] == ["e1", "e2", "e3"]
    assert [e.curve for e in graph.expressions] == [0, 1, 1]
    assert graph.count == 3 and graph.skipped_count == 0


def test_unusable_segments_are_skipped_and_counted_not_emitted() -> None:
    curves = [
        FittedCurve(
            False,
            [
                segment("line", [[0, 0], [0, 0]]),
                segment("line", [[0, 0], [np.nan, 1]]),
                segment("line", [[0, 0], [2, 0]]),
                segment("circle", center=(0.0, 0.0), radius=0.0),
                segment("bezier", [[1, 1]] * 4),
            ],
            10,
        )
    ]
    graph = serialize_curves(curves)
    assert graph.count == 1
    assert graph.skipped == {"degenerate": 3, "invalid_geometry": 1}
    assert graph.skipped_count == 4
    assert graph.expressions[0].id == "e1"  # ids stay consecutive


def test_empty_input() -> None:
    graph = serialize_curves([])
    assert graph.count == 0 and graph.skipped == {} and graph.expressions == []
    assert serialize_curves([FittedCurve(False, [], 0)]).count == 0


def test_segment_latex_rejects_malformed_segments() -> None:
    assert segment_latex(segment("line", [[0, 0]])) == "invalid_geometry"
    assert segment_latex(segment("bezier", [[0, 0], [1, 1]])) == "invalid_geometry"
    assert segment_latex(segment("circle")) == "invalid_geometry"


def test_serialization_is_deterministic() -> None:
    t = np.linspace(0, 2 * np.pi, 600, endpoint=False)
    heart = np.c_[16 * np.sin(t) ** 3, 13 * np.cos(t) - 5 * np.cos(2 * t) - np.cos(4 * t)] / 3
    curve = fit_stroke(heart, True, 0.03, 0.3)
    first, second = serialize_curves([curve]), serialize_curves([curve])
    assert [e.latex for e in first.expressions] == [e.latex for e in second.expressions]
    assert first.count == len(curve.segments)


def test_fitted_shapes_serialize_to_expressions_that_trace_the_original_points() -> None:
    t = np.linspace(0, 2 * np.pi, 400, endpoint=False)
    shape = np.c_[8 * np.cos(t), 4 * np.sin(t)]  # an ellipse -> Béziers
    curve = fit_stroke(shape, True, 0.03, 0.3)
    graph = serialize_curves([curve])
    assert graph.count == len(curve.segments) >= 2
    dense = np.linspace(0, 1, 2000)
    sampled = np.vstack([eval_parametric(e.latex, dense) for e in graph.expressions])
    # Every original point lies close to some point of the plotted expressions.
    gaps = np.linalg.norm(shape[:, None, :] - sampled[None, :, :], axis=2).min(axis=1)
    assert gaps.max() < 0.05


# ---- API ------------------------------------------------------------------

client = TestClient(app)


def post(data: bytes, **fields: object):
    return client.post(
        "/api/process",
        files={"file": ("shape.png", data, "image/png")},
        data={k: str(v) for k, v in fields.items()},
    )


def test_api_returns_expressions_matching_the_fitted_segments() -> None:
    body = post(synthetic.to_bytes(synthetic.circle_ring())).json()
    desmos = body["desmos"]
    assert desmos["count"] == len(desmos["expressions"]) == body["fit"]["segment_count"] == 2
    assert desmos["skipped_count"] == 0 and desmos["skipped"] == {}
    for expr in desmos["expressions"]:
        assert expr["type"] == "circle"
        assert re.fullmatch(r"[A-Za-z0-9_]+", expr["id"])
        assert expr["latex"].endswith("^2")


def test_api_square_expressions_are_valid_parametrics() -> None:
    body = post(synthetic.to_bytes(synthetic.square())).json()
    expressions = body["desmos"]["expressions"]
    assert expressions and body["desmos"]["count"] == body["fit"]["segment_count"]
    ids = [e["id"] for e in expressions]
    assert len(set(ids)) == len(ids)
    for expr in expressions:
        assert expr["type"] in {"line", "bezier"}
        assert PARAMETRIC.fullmatch(expr["latex"])


def test_api_blank_image_has_no_expressions() -> None:
    body = post(synthetic.to_bytes(synthetic.blank())).json()
    assert body["desmos"] == {"expressions": [], "count": 0, "skipped": {}, "skipped_count": 0}


def test_api_expressions_are_deterministic() -> None:
    data = synthetic.to_bytes(synthetic.square_with_inner_circle())
    a, b = post(data).json()["desmos"], post(data).json()["desmos"]
    assert a == b
