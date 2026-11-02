"""Deterministic LaTeX building blocks for Desmos expressions."""

import math
from collections.abc import Sequence

DECIMALS = 5
PARAMETER = "t"
PARAMETER_DOMAIN = r"\left\{0\le t\le1\right\}"


def number(value: float) -> str:
    """Shortest fixed-point text for ``value`` at ``DECIMALS`` places.

    Never emits exponents, trailing zeros or a negative zero, so the same
    input always yields the same text.
    """
    text = f"{value:.{DECIMALS}f}".rstrip("0").rstrip(".")
    return "0" if text in ("", "-0") else text


def is_zero(value: float) -> bool:
    return number(value) == "0"


def polynomial(coefficients: Sequence[float]) -> str:
    """Polynomial in ``t``; ``coefficients[k]`` multiplies ``t**k``.

    Zero terms are dropped: ``polynomial([4, -1, 2, -1.5])`` is
    ``-1.5t^3+2t^2-t+4``.
    """
    out = ""
    for power in range(len(coefficients) - 1, -1, -1):
        text = number(coefficients[power])
        if text == "0":
            continue
        negative = text.startswith("-")
        magnitude = text[1:] if negative else text
        if power == 0:
            body = magnitude
        else:
            variable = PARAMETER if power == 1 else f"{PARAMETER}^{power}"
            body = variable if magnitude == "1" else f"{magnitude}{variable}"
        if not out:
            out = f"-{body}" if negative else body
        else:
            out += f"-{body}" if negative else f"+{body}"
    return out or "0"


def parametric(x_coefficients: Sequence[float], y_coefficients: Sequence[float]) -> str:
    """A point ``(x(t), y(t))`` restricted to ``0 <= t <= 1``."""
    x, y = polynomial(x_coefficients), polynomial(y_coefficients)
    return rf"\left({x},{y}\right){PARAMETER_DOMAIN}"


def shifted_square(variable: str, offset: float) -> str:
    """``(variable - offset)^2`` without a redundant ``- 0``."""
    text = number(offset)
    if text == "0":
        return rf"{variable}^2"
    sign = "+" if text.startswith("-") else "-"
    magnitude = text[1:] if text.startswith("-") else text
    return rf"\left({variable}{sign}{magnitude}\right)^2"


def circle(cx: float, cy: float, radius: float) -> str:
    return rf"{shifted_square('x', cx)}+{shifted_square('y', cy)}={number(radius)}^2"


def all_finite(*values: float) -> bool:
    return all(math.isfinite(v) for v in values)
