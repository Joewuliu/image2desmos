"""Tunable parameters and fixed limits for the deterministic image pipeline."""

from dataclasses import dataclass

# Images larger than this (longest side, in pixels) are downscaled before
# processing so that runtime and output size stay bounded.
WORKING_MAX_DIM: int = 1600

# Contours shorter than this (arc length, as a fraction of the longest side)
# are discarded as specks.
MIN_CONTOUR_LENGTH_FRACTION: float = 0.02

# Upper bound on simplified points returned for one image.
MAX_TOTAL_POINTS: int = 60_000

# The longest image side spans this many Cartesian units (Desmos' default
# window is roughly -10..10 on the x axis).
CARTESIAN_SPAN: float = 20.0

BLUR_SIGMA_RANGE: tuple[float, float] = (0.0, 5.0)
SENSITIVITY_RANGE: tuple[float, float] = (0.0, 100.0)
SIMPLIFY_RANGE: tuple[float, float] = (0.0, 10.0)


@dataclass(frozen=True)
class ProcessingParams:
    """User-facing controls.

    blur_sigma: Gaussian sigma in pixels; 0 disables blurring.
    edge_sensitivity: 0 (only strong edges) to 100 (faint edges too).
    simplify: polygon simplification strength; 0 keeps every contour pixel.
    """

    blur_sigma: float = 1.0
    edge_sensitivity: float = 50.0
    simplify: float = 2.0

    def __post_init__(self) -> None:
        for name, value, (lo, hi) in (
            ("blur_sigma", self.blur_sigma, BLUR_SIGMA_RANGE),
            ("edge_sensitivity", self.edge_sensitivity, SENSITIVITY_RANGE),
            ("simplify", self.simplify, SIMPLIFY_RANGE),
        ):
            if not lo <= value <= hi:
                raise ValueError(f"{name} must be between {lo} and {hi}")
