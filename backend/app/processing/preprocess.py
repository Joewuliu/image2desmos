"""Decoding, grayscale conversion, resizing and blurring."""

import math
from io import BytesIO

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image, ImageOps

from app.processing.params import WORKING_MAX_DIM

GrayImage = NDArray[np.uint8]


def decode_to_gray(data: bytes) -> GrayImage:
    """Decode PNG/JPEG bytes to an 8-bit grayscale array.

    EXIF orientation is applied so the result matches what a browser shows,
    and transparency is composited onto white (typical for line art PNGs).
    """
    with Image.open(BytesIO(data)) as raw:
        img = ImageOps.exif_transpose(raw)
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            rgba = img.convert("RGBA")
            background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            img = Image.alpha_composite(background, rgba)
        gray = img.convert("L")
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
