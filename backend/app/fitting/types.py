"""Result types for curve fitting. All coordinates are Cartesian (y up)."""

from dataclasses import dataclass, field
from typing import Literal

import numpy as np
from numpy.typing import NDArray

Array = NDArray[np.float64]
SegmentType = Literal["line", "bezier", "circle"]


@dataclass(frozen=True)
class Segment:
    """One fitted piece.

    line:   ``points`` = [start, end]
    bezier: ``points`` = [start, control1, control2, end] (cubic)
    circle: a full circle; ``center`` and ``radius`` are set, ``points`` is empty
    """

    type: SegmentType
    points: Array
    max_error: float
    center: tuple[float, float] | None = None
    radius: float | None = None

    @property
    def start(self) -> Array:
        return self.points[0]

    @property
    def end(self) -> Array:
        return self.points[-1]


@dataclass(frozen=True)
class FittedCurve:
    """A connected run of segments: one traced stroke."""

    closed: bool
    segments: list[Segment]
    source_points: int

    @property
    def max_error(self) -> float:
        return max((s.max_error for s in self.segments), default=0.0)


@dataclass(frozen=True)
class FitSummary:
    curve_count: int = 0
    segment_count: int = 0
    line_count: int = 0
    bezier_count: int = 0
    circle_count: int = 0
    max_error: float = 0.0
    mean_error: float = 0.0
    warnings: list[str] = field(default_factory=list)
