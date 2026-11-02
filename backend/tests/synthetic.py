"""Synthetic images with known geometry for deterministic tests."""

from io import BytesIO

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image


def blank(size: int = 200) -> NDArray[np.uint8]:
    return np.full((size, size), 255, dtype=np.uint8)


def square(size: int = 200, side: int = 100) -> NDArray[np.uint8]:
    img = blank(size)
    lo = (size - side) // 2
    cv2.rectangle(img, (lo, lo), (lo + side - 1, lo + side - 1), 0, thickness=-1)
    return img


def circle_ring(size: int = 200, radius: int = 60) -> NDArray[np.uint8]:
    img = blank(size)
    cv2.circle(img, (size // 2, size // 2), radius, 0, thickness=3)
    return img


def square_with_inner_circle(size: int = 300) -> NDArray[np.uint8]:
    img = blank(size)
    cv2.rectangle(img, (40, 40), (260, 260), 0, thickness=3)
    cv2.circle(img, (150, 150), 50, 0, thickness=3)
    return img


def noise(size: int = 300, seed: int = 0) -> NDArray[np.uint8]:
    rng = np.random.default_rng(seed)
    return rng.integers(0, 256, size=(size, size), dtype=np.uint8)


def to_bytes(gray: NDArray[np.uint8], fmt: str = "PNG") -> bytes:
    buf = BytesIO()
    Image.fromarray(gray).save(buf, format=fmt)
    return buf.getvalue()
