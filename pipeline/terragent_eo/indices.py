"""Spectral indices on reflectance arrays. Pure numpy, no IO."""

from __future__ import annotations

import numpy as np


# Sentinel-2 L2A processing baseline >= 04.00 (Jan 2022+) stores
# DN = reflectance * 10000 + 1000 (BOA_ADD_OFFSET = -1000). Ignoring the offset
# squeezes every normalized-difference index toward 0 (the root cause of the
# v1 "NDWI-only water fraction ~0" result).
BOA_OFFSET_DN = 1000
MIN_REFLECTANCE = 1e-4


def boa_offset_for(processing_baseline: str | None) -> int:
    """DN offset to subtract for a given `s2:processing_baseline` string."""
    if not processing_baseline:
        return BOA_OFFSET_DN  # all current archive scenes are >= 04.00
    try:
        return BOA_OFFSET_DN if float(processing_baseline) >= 4.0 else 0
    except ValueError:
        return BOA_OFFSET_DN


def to_reflectance(dn: np.ndarray, offset: int = BOA_OFFSET_DN) -> np.ndarray:
    """Sentinel-2 L2A DN -> surface reflectance. DN 0 is nodata -> NaN.
    Values at/below the offset (very dark water in SWIR) clamp to a tiny
    positive reflectance instead of going negative."""
    dn = np.asarray(dn, dtype="float32")
    refl = np.maximum((dn - offset) / 10000.0, MIN_REFLECTANCE)
    return np.where(dn <= 0, np.nan, refl).astype("float32")


def safe_div(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        return a / np.where(np.abs(b) < 1e-6, np.nan, b)


def ndwi(green: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """McFeeters NDWI = (G - NIR) / (G + NIR)."""
    return safe_div(green - nir, green + nir)


def mndwi(green: np.ndarray, swir: np.ndarray) -> np.ndarray:
    """Xu MNDWI = (G - SWIR1) / (G + SWIR1)."""
    return safe_div(green - swir, green + swir)


def ndvi(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    return safe_div(nir - red, nir + red)
