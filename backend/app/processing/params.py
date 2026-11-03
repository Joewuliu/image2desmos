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
# Maximum distance (in working-image pixels) a fitted curve may stray from the traced outline.
FIT_TOLERANCE_RANGE: tuple[float, float] = (0.5, 5.0)
# Strokes whose longest bounding-box side is below this percentage of the image's longest side are dropped.
MIN_CONTOUR_SIZE_RANGE: tuple[float, float] = (0.0, 20.0)

# Upper bounds that keep fitting time and response size reasonable.
MAX_FIT_POINTS: int = 150_000
MAX_SEGMENTS: int = 20_000

# Edge traces are quantised to whole pixels (about half a pixel of jitter), and
# errors are reported against that raw trace, so curves are fitted to this share
# of the requested tolerance to leave room for the jitter.
FIT_JITTER_HEADROOM: float = 0.65

# Corner window: neighbours used for tangent and corner estimates are this
# many pixels away along the stroke (never less than the fraction of the image).
FIT_WINDOW_MIN_PX: float = 3.0
FIT_WINDOW_FRACTION: float = 0.01


@dataclass(frozen=True)
class ProcessingParams:
    """User-facing controls.

    blur_sigma: Gaussian sigma in pixels; 0 disables blurring.
    edge_sensitivity: 0 (only strong edges) to 100 (faint edges too).
    simplify: polygon simplification strength; 0 keeps every contour pixel.
    fit_tolerance: max curve-to-outline distance in pixels (lower = tighter, more segments).
    min_contour_size: minimum stroke size as a percentage of the image's longest side.
    """

    blur_sigma: float = 1.0
    edge_sensitivity: float = 50.0
    simplify: float = 2.0
    fit_tolerance: float = 1.0
    min_contour_size: float = 1.0

    def __post_init__(self) -> None:
        for name, value, (lo, hi) in (
            ("blur_sigma", self.blur_sigma, BLUR_SIGMA_RANGE),
            ("edge_sensitivity", self.edge_sensitivity, SENSITIVITY_RANGE),
            ("simplify", self.simplify, SIMPLIFY_RANGE),
            ("fit_tolerance", self.fit_tolerance, FIT_TOLERANCE_RANGE),
            ("min_contour_size", self.min_contour_size, MIN_CONTOUR_SIZE_RANGE),
        ):
            if not lo <= value <= hi:
                raise ValueError(f"{name} must be between {lo} and {hi}")
