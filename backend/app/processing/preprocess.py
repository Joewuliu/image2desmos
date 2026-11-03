"""Decoding, grayscale conversion, resizing and blurring."""

import math
from io import BytesIO

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image

from app.processing.params import WORKING_MAX_DIM

GrayImage = NDArray[np.uint8]

_ORIENTATION_TAG = 0x0112
_EXIF_ORIENTATION: dict[int, Image.Transpose] = {
    2: Image.Transpose.FLIP_LEFT_RIGHT,
    3: Image.Transpose.ROTATE_180,
    4: Image.Transpose.FLIP_TOP_BOTTOM,
    5: Image.Transpose.TRANSPOSE,
    6: Image.Transpose.ROTATE_270,
    7: Image.Transpose.TRANSVERSE,
    8: Image.Transpose.ROTATE_90,
}


def _transposition(image: Image.Image) -> Image.Transpose | None:
    return _EXIF_ORIENTATION.get(image.getexif().get(_ORIENTATION_TAG, 1))


def _to_gray(image: Image.Image) -> Image.Image:
    """Flatten to 8-bit gray, compositing any transparency onto white.

    Works one channel at a time: a 25 MP RGBA image would otherwise need
    several 100 MB copies, more than a small server has.
    """
    has_alpha = image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info
    if not has_alpha:
        return image.convert("L")
    rgba = image if image.mode in ("RGBA", "LA") else image.convert("RGBA")
    gray = Image.new("L", rgba.size, 255)
    gray.paste(rgba.convert("L"), mask=rgba.getchannel("A"))
    return gray


def decode_to_gray(data: bytes) -> GrayImage:
    """Decode PNG/JPEG bytes to an 8-bit grayscale array.

    EXIF orientation is applied so the result matches what a browser shows,
    and transparency is composited onto white (typical for line art PNGs).
    Images far larger than the working size are shrunk while decoding, because
    the full-size pixels are never used and memory is what limits a public server.
    """
    with Image.open(BytesIO(data)) as raw:
        oversized = max(raw.size) >= 2 * WORKING_MAX_DIM
        if oversized:
            raw.draft("L", (2 * WORKING_MAX_DIM, 2 * WORKING_MAX_DIM))  # JPEG only
        raw.load()
        transposition = _transposition(raw)
        gray = _to_gray(raw)
    factor = max(gray.size) // WORKING_MAX_DIM
    if factor >= 2:
        gray = gray.reduce(factor)
    if transposition is not None:
        gray = gray.transpose(transposition)
    return np.asarray(gray, dtype=np.uint8).copy()


def limit_size(gray: GrayImage, max_dim: int = WORKING_MAX_DIM) -> GrayImage:
    """Downscale (never upscale) so the longest side is at most ``max_dim``."""
    h, w = gray.shape
    longest = max(h, w)
    if longest <= max_dim:
        return gray
    factor = max_dim / longest
    size = (max(1, round(w * factor)), max(1, round(h * factor)))
    return cv2.resize(gray, size, interpolation=cv2.INTER_AREA)


def gaussian_kernel_size(sigma: float) -> int:
    """Odd kernel size covering +/- 3 sigma; 0 means no blur."""
    if sigma <= 0:
        return 0
    return 2 * math.ceil(3 * sigma) + 1


def blur(gray: GrayImage, sigma: float) -> GrayImage:
    ksize = gaussian_kernel_size(sigma)
    if ksize == 0:
        return gray
    return cv2.GaussianBlur(gray, (ksize, ksize), sigmaX=sigma)
