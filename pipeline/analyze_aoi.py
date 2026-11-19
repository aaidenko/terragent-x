#!/usr/bin/env python3
"""Terragent EO factory — maximal optical water analysis for a hackathon window.

Stack:
  1) Sentinel-2 L2A via Planetary Computer STAC
  2) SCL cloud/shadow/snow mask
  3) NDWI + MNDWI spectral indices
  4) Weakly-supervised 2-layer MLP water classifier (numpy) trained on-scene
     using high-confidence NDWI/MNDWI labels, then applied to all clear pixels
  5) Baseline vs recent delta when a prior clear scene exists

Stdout: one JSON object. Never prints tracebacks to stdout.
"""

from __future__ import annotations

import json
import sys
import traceback
from typing import Any

import numpy as np
import planetary_computer as pc
import rasterio
from pystac_client import Client
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from rasterio.windows import Window, from_bounds

# SCL classes to treat as invalid for water mapping
_SCL_BAD = {0, 1, 2, 3, 8, 9, 10, 11}  # no data, sat, shadow, cloud shadow, cloud, cirrus, snow


def _clip_window(ds: rasterio.io.DatasetReader, bbox_wgs84: list[float]) -> Window:
    left, bottom, right, top = transform_bounds(
        "EPSG:4326", ds.crs, *bbox_wgs84, densify_pts=21
    )
    left = max(left, ds.bounds.left)
    right = min(right, ds.bounds.right)
    bottom = max(bottom, ds.bounds.bottom)
    top = min(top, ds.bounds.top)
    if left >= right or bottom >= top:
        raise RuntimeError("AOI does not intersect selected Sentinel tile")
    window = from_bounds(left, bottom, right, top, transform=ds.transform)
    return window.intersection(Window(0, 0, ds.width, ds.height))


def _read_band(href: str, bbox: list[float], out_h: int, out_w: int, window: Window | None = None):
    with rasterio.open(href) as ds:
        win = window or _clip_window(ds, bbox)
        data = ds.read(
            1,
            window=win,
            out_shape=(out_h, out_w),
            resampling=Resampling.bilinear if ds.count else Resampling.nearest,
        ).astype("float32")
        return data, win


def _safe_div(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return a / np.where(np.abs(b) < 1e-6, np.nan, b)


def _mlp_water_mask(features: np.ndarray, weak_pos: np.ndarray, weak_neg: np.ndarray) -> tuple[np.ndarray, dict[str, Any]]:
    """Tiny 2-layer MLP trained with SGD on weak labels. Pure numpy."""
    rng = np.random.default_rng(42)
    pos_idx = np.flatnonzero(weak_pos)
    neg_idx = np.flatnonzero(weak_neg)
    if len(pos_idx) < 40 or len(neg_idx) < 40:
        return weak_pos, {
            "trained": False,
            "reason": "insufficient weak labels",
            "pos": int(len(pos_idx)),
            "neg": int(len(neg_idx)),
        }

    n_pos = min(800, len(pos_idx))
    n_neg = min(800, len(neg_idx))
    pos_pick = rng.choice(pos_idx, size=n_pos, replace=False)
    neg_pick = rng.choice(neg_idx, size=n_neg, replace=False)
    sel = np.concatenate([pos_pick, neg_pick])
    rng.shuffle(sel)
    pos_set = set(pos_pick.tolist())
    X = features[sel]
    y = np.array([1.0 if i in pos_set else 0.0 for i in sel], dtype=np.float32)

    # standardize
    mu = X.mean(axis=0)
    sigma = X.std(axis=0) + 1e-6
    Xn = (X - mu) / sigma

    d = Xn.shape[1]
    h = 8
    W1 = rng.normal(0, 0.2, size=(d, h)).astype(np.float32)
    b1 = np.zeros(h, dtype=np.float32)
    W2 = rng.normal(0, 0.2, size=(h, 1)).astype(np.float32)
    b2 = np.zeros(1, dtype=np.float32)
    lr = 0.08
    for _ in range(60):
        z1 = Xn @ W1 + b1
        a1 = np.maximum(z1, 0)
        z2 = a1 @ W2 + b2
        # sigmoid
        p = 1.0 / (1.0 + np.exp(-np.clip(z2.ravel(), -20, 20)))
        err = (p - y) / len(y)
        # grads
        dW2 = a1.T @ err.reshape(-1, 1)
        db2 = err.sum(keepdims=True)
        da1 = err.reshape(-1, 1) @ W2.T
        dz1 = da1 * (z1 > 0)
        dW1 = Xn.T @ dz1
        db1 = dz1.sum(axis=0)
        W2 -= lr * dW2.astype(np.float32)
        b2 -= lr * db2.astype(np.float32)
        W1 -= lr * dW1.astype(np.float32)
        b1 -= lr * db1.astype(np.float32)

    # train accuracy
    z1 = Xn @ W1 + b1
    a1 = np.maximum(z1, 0)
    p = 1.0 / (1.0 + np.exp(-np.clip((a1 @ W2 + b2).ravel(), -20, 20)))
    acc = float(((p >= 0.5) == (y >= 0.5)).mean())

    # apply to all pixels
    Fn = (features - mu) / sigma
    z1 = Fn @ W1 + b1
    a1 = np.maximum(z1, 0)
    prob = 1.0 / (1.0 + np.exp(-np.clip((a1 @ W2 + b2).ravel(), -20, 20)))
    mask = prob >= 0.55
    return mask, {
        "trained": True,
        "hidden": h,
        "epochs": 60,
        "train_acc": round(acc, 4),
        "train_pos": int(n_pos),
        "train_neg": int(n_neg),
        "prob_threshold": 0.55,
    }


def _analyze_scene(item: Any, bbox: list[float], scale: int = 10) -> dict[str, Any]:
    signed = pc.sign(item)
    # establish window from B03
    with rasterio.open(signed.assets["B03"].href) as ds:
        window = _clip_window(ds, bbox)
        out_h = max(32, int(window.height // scale))
        out_w = max(32, int(window.width // scale))

    def band(name: str, nearest: bool = False) -> np.ndarray:
        with rasterio.open(signed.assets[name].href) as ds:
            return ds.read(
                1,
                window=_clip_window(ds, bbox) if True else window,
                out_shape=(out_h, out_w),
                resampling=Resampling.nearest if nearest else Resampling.bilinear,
            ).astype("float32")

    b03 = band("B03")  # green
    b08 = band("B08")  # nir
    b11 = band("B11")  # swir
    b04 = band("B04")  # red
    b02 = band("B02")  # blue
    scl = band("SCL", nearest=True)

    def refl(x: np.ndarray) -> np.ndarray:
        return np.where(x <= 0, np.nan, x / 10000.0)

    g, nir, swir, red, blue = map(refl, (b03, b08, b11, b04, b02))
    clear = ~np.isin(scl, list(_SCL_BAD)) & np.isfinite(g) & np.isfinite(nir) & np.isfinite(swir)

    ndwi = _safe_div(g - nir, g + nir)
    mndwi = _safe_div(g - swir, g + swir)
    ndvi = _safe_div(nir - red, nir + red)

    # weak labels: confident water / land on clear pixels
    # Use percentile fallback so riverine AOIs still yield enough positives.
    ndwi_clear_vals = ndwi[clear]
    if ndwi_clear_vals.size > 0:
        p95 = float(np.nanpercentile(ndwi_clear_vals, 95))
        p90 = float(np.nanpercentile(ndwi_clear_vals, 90))
    else:
        p95, p90 = 0.2, 0.15
    weak_pos = clear & (
        ((ndwi > 0.15) & (mndwi > 0.05))
        | (ndwi >= max(p90, 0.05))
    )
    weak_neg = clear & (ndwi < 0.0) & (mndwi < 0.0) & (ndvi > 0.15)
    # keep label sets from collapsing if water is scarce
    if int(weak_pos.sum()) < 40 and ndwi_clear_vals.size > 100:
        weak_pos = clear & (ndwi >= p95)

    # features for MLP (flatten)
    feats = np.stack(
        [
            np.nan_to_num(g, nan=0),
            np.nan_to_num(nir, nan=0),
            np.nan_to_num(swir, nan=0),
            np.nan_to_num(red, nan=0),
            np.nan_to_num(blue, nan=0),
            np.nan_to_num(ndwi, nan=0),
            np.nan_to_num(mndwi, nan=0),
            np.nan_to_num(ndvi, nan=0),
        ],
        axis=-1,
    ).reshape(-1, 8)
    weak_pos_f = weak_pos.ravel()
    weak_neg_f = weak_neg.ravel()
    clear_f = clear.ravel()

    mlp_mask_f, mlp_meta = _mlp_water_mask(feats, weak_pos_f, weak_neg_f)
    # index fusion: MLP if trained else NDWI∪MNDWI
    if mlp_meta.get("trained"):
        water_f = mlp_mask_f & clear_f
        model_name = "weakly_supervised_mlp"
    else:
        water_f = (weak_pos_f | ((ndwi.ravel() > 0.15) & (mndwi.ravel() > 0.05) & clear_f)) & clear_f
        model_name = "ndwi_mndwi_fusion"

    clear_n = int(clear_f.sum())
    if clear_n == 0:
        raise RuntimeError("No clear pixels after SCL mask")

    water_n = int(water_f.sum())
    ndwi_clear = ndwi.ravel()[clear_f]

    return {
        "scene_id": item.id,
        "datetime": item.properties.get("datetime"),
        "cloud_cover_pct": float(item.properties.get("eo:cloud_cover", -1)),
        "clear_pixel_fraction": float(clear_n / max(1, clear_f.size)),
        "ndwi_mean": float(np.nanmean(ndwi_clear)),
        "ndwi_p90": float(np.nanpercentile(ndwi_clear, 90)),
        "mndwi_mean": float(np.nanmean(mndwi.ravel()[clear_f])),
        "water_fraction": float(water_n / clear_n),
        "water_fraction_ndwi_only": float(((ndwi.ravel() > 0.15) & clear_f).sum() / clear_n),
        "valid_pixels": clear_n,
        "model": model_name,
        "mlp": mlp_meta,
        "threshold_ndwi": 0.15,
        "collection": "sentinel-2-l2a",
        "source": "Microsoft Planetary Computer STAC",
        "bands": ["B02", "B03", "B04", "B08", "B11", "SCL"],
    }


def _search(bbox: list[float], start: str, end: str, max_cloud: float, limit: int = 8):
    catalog = Client.open(
        "https://planetarycomputer.microsoft.com/api/stac/v1",
        modifier=pc.sign_inplace,
    )
    search = catalog.search(
        collections=["sentinel-2-l2a"],
        bbox=bbox,
        datetime=f"{start}/{end}",
        query={"eo:cloud_cover": {"lt": max_cloud}},
        max_items=limit,
    )
    return list(search.items())


def analyze(payload: dict[str, Any]) -> dict[str, Any]:
    lat = float(payload.get("lat", 28.386))
    lon = float(payload.get("lon", -80.742))
    pad = float(payload.get("pad_deg", 0.12))
    if pad <= 0 or pad > 0.15:
        return {
            "ok": False,
            "error": "pad_deg out of allowed range",
            "limitations": ["AOI pad rejected"],
        }
    bbox = [lon - pad, lat - pad, lon + pad, lat + pad]
    recent_start = payload.get("recent_start", "2026-11-01")
    recent_end = payload.get("recent_end", "2026-11-19")
    baseline_start = payload.get("baseline_start", "2026-10-01")
    baseline_end = payload.get("baseline_end", "2026-10-31")

    limitations: list[str] = []
    method = [
        "Sentinel-2 L2A via Planetary Computer STAC",
        "SCL mask removes cloud/shadow/snow pixels",
        "NDWI (Green−NIR) + MNDWI (Green−SWIR)",
        "Weakly-supervised 2-layer MLP on spectral features (numpy SGD)",
        "Water fraction = clear-pixel MLP/index mask",
    ]

    recent_items = _search(bbox, recent_start, recent_end, max_cloud=60)
    if not recent_items:
        recent_items = _search(bbox, recent_start, recent_end, max_cloud=95)
        limitations.append("Only high-cloud scenes available in recent window")
    if not recent_items:
        return {
            "ok": False,
            "error": "No Sentinel-2 scenes for AOI/window",
            "bbox": bbox,
            "limitations": limitations
            + ["Optical stack unavailable — fall back to gauge/alert fusion"],
            "method": method,
        }

    recent_item = sorted(
        recent_items, key=lambda i: i.properties.get("eo:cloud_cover", 100)
    )[0]
    recent = _analyze_scene(recent_item, bbox)

    baseline = None
    delta = None
    try:
        baseline_items = _search(bbox, baseline_start, baseline_end, max_cloud=40)
        if baseline_items:
            baseline_item = sorted(
                baseline_items, key=lambda i: i.properties.get("eo:cloud_cover", 100)
            )[0]
            baseline = _analyze_scene(baseline_item, bbox)
            delta = {
                "water_fraction_delta": recent["water_fraction"]
                - baseline["water_fraction"],
                "ndwi_mean_delta": recent["ndwi_mean"] - baseline["ndwi_mean"],
            }
            method.append("Baseline vs recent water-fraction delta")
        else:
            limitations.append("No clear baseline scene in prior month")
    except Exception as exc:  # noqa: BLE001
        limitations.append(f"Baseline compare skipped: {type(exc).__name__}")

    if recent["cloud_cover_pct"] > 40:
        limitations.append(
            f"Recent scene cloud cover {recent['cloud_cover_pct']:.1f}% — water mask may undercount"
        )
    if recent["water_fraction"] < 0.02:
        limitations.append(
            "Low optical water fraction — riverine flooding may be under tree cover / timing mismatch with peak stage"
        )
    if not recent.get("mlp", {}).get("trained"):
        limitations.append("MLP weak-label set thin — fell back to NDWI/MNDWI fusion")

    return {
        "ok": True,
        "bbox": bbox,
        "center": {"lat": lat, "lon": lon},
        "recent": recent,
        "baseline": baseline,
        "delta": delta,
        "method": method,
        "limitations": limitations,
    }


def main() -> int:
    try:
        if len(sys.argv) > 1:
            payload = json.loads(sys.argv[1])
        else:
            payload = json.load(sys.stdin)
        result = analyze(payload)
        result.pop("trace", None)
        print(json.dumps(result))
        return 0
    except Exception:  # noqa: BLE001
        sys.stderr.write(traceback.format_exc())
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "EO analysis unavailable",
                    "limitations": [
                        "EO pipeline raised — briefs should fall back to gauge/alert fusion"
                    ],
                }
            )
        )
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
