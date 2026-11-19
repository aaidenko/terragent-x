#!/usr/bin/env python3
"""Terragent EO factory: Sentinel-2 NDWI water mask + optional dual-date delta.

Reads JSON args from argv[1] or stdin. Prints one JSON object to stdout.
Handles missing scenes / cloud-heavy AOIs without inventing numbers.
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


def _read_ndwi(item: Any, bbox: list[float], scale: int = 8) -> dict[str, Any]:
    signed = pc.sign(item)
    with rasterio.open(signed.assets["B03"].href) as green_ds, rasterio.open(
        signed.assets["B08"].href
    ) as nir_ds:
        window = _clip_window(green_ds, bbox)
        out_h = max(32, int(window.height // scale))
        out_w = max(32, int(window.width // scale))
        green = green_ds.read(
            1, window=window, out_shape=(out_h, out_w), resampling=Resampling.bilinear
        ).astype("float32")
        nir = nir_ds.read(
            1, window=window, out_shape=(out_h, out_w), resampling=Resampling.bilinear
        ).astype("float32")

    green = np.where(green <= 0, np.nan, green / 10000.0)
    nir = np.where(nir <= 0, np.nan, nir / 10000.0)
    denom = green + nir
    ndwi = (green - nir) / np.where(np.abs(denom) < 1e-6, np.nan, denom)
    threshold = 0.15
    valid = np.isfinite(ndwi)
    water = (ndwi > threshold) & valid
    valid_n = int(valid.sum())
    if valid_n == 0:
        raise RuntimeError("No valid NDWI pixels (cloud/nodata)")

    return {
        "scene_id": item.id,
        "datetime": item.properties.get("datetime"),
        "cloud_cover_pct": float(item.properties.get("eo:cloud_cover", -1)),
        "ndwi_mean": float(np.nanmean(ndwi)),
        "ndwi_p90": float(np.nanpercentile(ndwi[valid], 90)),
        "water_fraction": float(water.sum() / valid_n),
        "valid_pixels": valid_n,
        "threshold": threshold,
        "collection": "sentinel-2-l2a",
        "source": "Microsoft Planetary Computer STAC",
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
    bbox = [
        lon - pad,
        lat - pad,
        lon + pad,
        lat + pad,
    ]
    # Prefer clearest recent scene + optional earlier baseline for delta
    recent_start = payload.get("recent_start", "2026-11-01")
    recent_end = payload.get("recent_end", "2026-11-19")
    baseline_start = payload.get("baseline_start", "2026-10-01")
    baseline_end = payload.get("baseline_end", "2026-10-31")

    limitations: list[str] = []
    method = [
        "Sentinel-2 L2A via Planetary Computer STAC",
        "NDWI = (Green B03 − NIR B08) / (Green + NIR)",
        "Water mask threshold NDWI > 0.15 on AOI window",
        "WGS84 AOI warped into scene UTM before read",
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
    recent = _read_ndwi(recent_item, bbox)

    baseline = None
    delta = None
    try:
        baseline_items = _search(bbox, baseline_start, baseline_end, max_cloud=40)
        if baseline_items:
            baseline_item = sorted(
                baseline_items, key=lambda i: i.properties.get("eo:cloud_cover", 100)
            )[0]
            baseline = _read_ndwi(baseline_item, bbox)
            delta = {
                "water_fraction_delta": recent["water_fraction"]
                - baseline["water_fraction"],
                "ndwi_mean_delta": recent["ndwi_mean"] - baseline["ndwi_mean"],
            }
            method.append("Baseline vs recent water-fraction delta")
        else:
            limitations.append("No clear baseline scene in prior month")
    except Exception as exc:  # noqa: BLE001
        limitations.append(f"Baseline compare skipped: {exc}")

    if recent["cloud_cover_pct"] > 40:
        limitations.append(
            f"Recent scene cloud cover {recent['cloud_cover_pct']:.1f}% — water mask may undercount"
        )
    if recent["water_fraction"] < 0.02:
        limitations.append(
            "Low optical water fraction — riverine flooding may be under tree cover / timing mismatch with peak stage"
        )

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
        print(json.dumps(result))
        return 0 if result.get("ok", False) or result.get("error") else 1
    except Exception as exc:  # noqa: BLE001
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": str(exc),
                    "trace": traceback.format_exc().splitlines()[-3:],
                    "limitations": [
                        "EO pipeline raised — briefs should fall back to gauge/alert fusion"
                    ],
                }
            )
        )
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
