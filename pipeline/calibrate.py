#!/usr/bin/env python3
"""Calibrate water masks against reference permanent water.

Usage: python3 pipeline/calibrate.py [--out pipeline/calibration/results.json]

For each AOI: pick the clearest Sentinel-2 L2A scene in the calibration
window, compute candidate masks on SCL-clear pixels, and score each against
JRC GSW occurrence >= 50% (primary reference) and ESA WorldCover 2021 class 80
(secondary). Writes every number it computes, with scene/item IDs, to JSON.
Network required. Nothing here is hand-entered.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from terragent_eo import calibration, indices, masks, stac  # noqa: E402

AOIS = [
    {"name": "Cape Canaveral / Indian River lagoon (coastal)", "lat": 28.386, "lon": -80.742},
    {"name": "St. Johns River floodplain, Lake Poinsett FL (river floodplain)", "lat": 28.34, "lon": -80.93},
    {"name": "Mississippi River floodplain near Vicksburg MS (river floodplain)", "lat": 32.35, "lon": -90.92},
    {"name": "Lake Tahoe shoreline CA/NV (inland lake)", "lat": 39.17, "lon": -120.05},
    {"name": "Phoenix AZ (dry / urban control)", "lat": 33.45, "lon": -112.07},
]
PAD = 0.12
WINDOW = "2026-09-01/2026-10-31"
NDWI_SWEEP = [-0.2, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.3]
MNDWI_SWEEP = [-0.2, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.3]


def run_aoi(aoi: dict) -> dict:
    lat, lon = aoi["lat"], aoi["lon"]
    bbox = [lon - PAD, lat - PAD, lon + PAD, lat + PAD]
    item = stac.clearest(stac.search(stac.S2_COLLECTION, bbox, WINDOW, max_cloud=20))
    if item is None:
        return {**aoi, "ok": False, "error": "no scene <20% cloud in window"}
    bands, grid = stac.read_s2_scene(item, bbox)
    off = indices.boa_offset_for(stac.processing_baseline(item))
    g, nir, swir, red, blue = (indices.to_reflectance(bands[b], off) for b in ("B03", "B08", "B11", "B04", "B02"))
    nd, mnd, nv = indices.ndwi(g, nir), indices.mndwi(g, swir), indices.ndvi(nir, red)
    clear = masks.clear_mask(bands["SCL"], g, nir, swir)
    ref = stac.read_reference_water(grid, bbox)
    occ, wc = ref["jrc_occurrence"], ref["worldcover"]
    if occ is None:
        return {**aoi, "ok": False, "error": "JRC reference unavailable", "scene_id": item.id}
    valid = clear & np.isfinite(occ)
    ref_jrc = np.nan_to_num(occ, nan=0) >= calibration.JRC_PERMANENT_OCCURRENCE
    ref_wc = (np.nan_to_num(wc, nan=0) == calibration.WORLDCOVER_WATER_CLASS) if wc is not None else None

    feats = masks.feature_stack(g, nir, swir, red, blue, nd, mnd, nv)
    cand: dict[str, np.ndarray] = {}
    # v1 reproduced exactly as shipped: no BOA offset, legacy weak labels.
    L = {b: indices.to_reflectance(bands[b], 0) for b in ("B03", "B08", "B11", "B04", "B02")}
    nd0, mnd0, nv0 = indices.ndwi(L["B03"], L["B08"]), indices.mndwi(L["B03"], L["B11"]), indices.ndvi(L["B08"], L["B04"])
    feats0 = masks.feature_stack(L["B03"], L["B08"], L["B11"], L["B04"], L["B02"], nd0, mnd0, nv0)
    p1, n1 = masks.legacy_weak_labels(nd0, mnd0, nv0, clear)
    m1, meta1 = masks.train_mlp(feats0, p1.ravel(), n1.ravel())
    if m1 is not None:
        cand["mlp_v1_legacy"] = m1.reshape(clear.shape) & clear
    p2, n2 = masks.weak_labels(nd, mnd, nv, clear)
    m2, meta2 = masks.train_mlp(feats, p2.ravel(), n2.ravel())
    if m2 is not None:
        cand["mlp_v2"] = m2.reshape(clear.shape) & clear
    cand["v1_ndwi>0.15_no_offset"] = masks.threshold_mask(nd0, 0.15, clear)
    cand["ndwi>0.15"] = masks.threshold_mask(nd, 0.15, clear)
    cand["ndwi>0"] = masks.threshold_mask(nd, 0.0, clear)
    cand["mndwi>0"] = masks.threshold_mask(mnd, 0.0, clear)
    cand["mndwi>0.1"] = masks.threshold_mask(mnd, 0.1, clear)
    cand["ndwi>0.15&mndwi>0"] = cand["ndwi>0.15"] & cand["mndwi>0"]
    cand["mndwi>0&ndwi>0"] = cand["mndwi>0"] & cand["ndwi>0"]
    cand["mndwi>0&ndwi>-0.1"] = cand["mndwi>0"] & masks.threshold_mask(nd, -0.1, clear)
    cand["mndwi>0&ndvi<0.1"] = cand["mndwi>0"] & (np.nan_to_num(nv, nan=1.0) < 0.1)

    scores = {}
    for k, m in cand.items():
        scores[k] = {"jrc_occ>=50": calibration.agreement(m, ref_jrc, valid)}
        if ref_wc is not None:
            scores[k]["worldcover_80"] = calibration.agreement(m, ref_wc, valid)
    sweep = {
        "ndwi": {str(t): calibration.agreement(masks.threshold_mask(nd, t, clear), ref_jrc, valid)["iou"] for t in NDWI_SWEEP},
        "mndwi": {str(t): calibration.agreement(masks.threshold_mask(mnd, t, clear), ref_jrc, valid)["iou"] for t in MNDWI_SWEEP},
    }
    return {
        **aoi,
        "ok": True,
        "bbox": bbox,
        "scene_id": item.id,
        "scene_datetime": item.properties.get("datetime"),
        "scene_cloud_pct": item.properties.get("eo:cloud_cover"),
        "processing_baseline": stac.processing_baseline(item),
        "boa_offset_dn": off,
        "reference_items": ref["items"],
        "clear_pixel_fraction": round(float(clear.mean()), 4),
        "valid_pixels": int(valid.sum()),
        "ref_water_fraction_jrc": round(float((ref_jrc & valid).sum() / max(1, valid.sum())), 4),
        "ref_water_fraction_worldcover": None if ref_wc is None else round(float((ref_wc & valid).sum() / max(1, valid.sum())), 4),
        "mlp_v1_meta": meta1,
        "mlp_v2_meta": meta2,
        "weak_pos_v1_fraction": round(float(p1.sum() / max(1, clear.sum())), 4),
        "weak_pos_v2_fraction": round(float(p2.sum() / max(1, clear.sum())), 4),
        "scores": scores,
        "iou_sweep_vs_jrc": sweep,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "calibration", "results.json"))
    args = ap.parse_args()
    results = []
    for aoi in AOIS:
        try:
            results.append(run_aoi(aoi))
        except Exception as exc:  # noqa: BLE001
            results.append({**aoi, "ok": False, "error": type(exc).__name__})
        r = results[-1]
        print(r["name"], r.get("scene_id"), "ok" if r.get("ok") else r.get("error"), file=sys.stderr)
    doc = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "window": WINDOW,
        "pad_deg": PAD,
        "grid": "Sentinel-2 10 m bands resampled x10 (~100 m pixels)",
        "reference_primary": "JRC Global Surface Water v1.3 occurrence >= 50% (jrc-gsw)",
        "reference_secondary": "ESA WorldCover 2021 class 80 permanent water (esa-worldcover)",
        "aois": results,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(doc, f, indent=2)
    print(args.out, file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
