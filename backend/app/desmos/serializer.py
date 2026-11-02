"""Fitted curves -> Desmos LaTeX expressions.

line    (x0 + (x1-x0)t, y0 + (y1-y0)t)         0 <= t <= 1
bezier  cubic Bernstein form expanded to a power-basis polynomial in t,
        (a3 t^3 + a2 t^2 + a1 t + a0, ...)       0 <= t <= 1
circle  (x-h)^2 + (y-k)^2 = r^2

Coordinates are the Cartesian (y up) values the fitter produced, which is what
Desmos plots, so nothing is transformed here. Output is deterministic: the
same curves always give the same text in the same order.
"""

from dataclasses import dataclass, field
from typing import Literal

import numpy as np

from app.desmos import latex
from app.fitting.types import FittedCurve, Segment

SkipReason = Literal["invalid_geometry", "degenerate"]


@dataclass(frozen=True)
class Expression:
    id: str
    latex: str
    type: Literal["line", "bezier", "circle"]
    curve: int  # index of the stroke this expression belongs to
    segment: int  # index of the fitted segment within that stroke


@dataclass(frozen=True)
class DesmosGraph:
    expressions: list[Expression] = field(default_factory=list)
    skipped: dict[str, int] = field(default_factory=dict)

    @property
    def count(self) -> int:
        return len(self.expressions)

    @property
    def skipped_count(self) -> int:
        return sum(self.skipped.values())


def line_latex(p0: np.ndarray, p1: np.ndarray) -> str | SkipReason:
    (x0, y0), (x1, y1) = p0, p1
    if not latex.all_finite(x0, y0, x1, y1):
        return "invalid_geometry"
    dx, dy = x1 - x0, y1 - y0
    if latex.is_zero(dx) and latex.is_zero(dy):
        return "degenerate"
    return latex.parametric([x0, dx], [y0, dy])


def _bezier_power_basis(p0: float, p1: float, p2: float, p3: float) -> list[float]:
    """Coefficients [a0, a1, a2, a3] of the cubic Bézier in powers of t."""
    return [
        p0,
        3 * (p1 - p0),
        3 * (p2 - 2 * p1 + p0),
        p3 - 3 * p2 + 3 * p1 - p0,
    ]


def bezier_latex(points: np.ndarray) -> str | SkipReason:
    if points.shape != (4, 2):
        return "invalid_geometry"
    if not np.all(np.isfinite(points)):
        return "invalid_geometry"
    x = _bezier_power_basis(*points[:, 0])
    y = _bezier_power_basis(*points[:, 1])
    # A curve whose t-dependent terms all vanish is a single point.
    if all(latex.is_zero(c) for c in (*x[1:], *y[1:])):
        return "degenerate"
    return latex.parametric(x, y)


def circle_latex(center: tuple[float, float] | None, radius: float | None) -> str | SkipReason:
    if center is None or radius is None:
        return "invalid_geometry"
    if not latex.all_finite(center[0], center[1], radius):
        return "invalid_geometry"
    if latex.is_zero(radius) or radius < 0:
        return "degenerate"
    return latex.circle(center[0], center[1], radius)


def segment_latex(segment: Segment) -> str | SkipReason:
    if segment.type == "line":
        if len(segment.points) != 2:
            return "invalid_geometry"
        return line_latex(segment.points[0], segment.points[1])
    if segment.type == "bezier":
        return bezier_latex(np.asarray(segment.points))
    if segment.type == "circle":
        return circle_latex(segment.center, segment.radius)
    return "invalid_geometry"


def serialize_curves(curves: list[FittedCurve]) -> DesmosGraph:
    """Serialize every supported segment; unusable ones are counted, not emitted."""
    expressions: list[Expression] = []
    skipped: dict[str, int] = {}
    for curve_index, curve in enumerate(curves):
        for segment_index, segment in enumerate(curve.segments):
            result = segment_latex(segment)
            if result in ("invalid_geometry", "degenerate"):
                skipped[result] = skipped.get(result, 0) + 1
                continue
            expressions.append(
                Expression(
                    id=f"e{len(expressions) + 1}",
                    latex=result,
                    type=segment.type,
                    curve=curve_index,
                    segment=segment_index,
                )
            )
    return DesmosGraph(expressions=expressions, skipped=dict(sorted(skipped.items())))
