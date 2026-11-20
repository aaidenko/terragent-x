"""Orchestration and output contract for one AOI.

Output keeps every v1 field (ok, bbox, center, recent, baseline, delta,
method, limitations; recent.water_fraction, water_fraction_ndwi_only, model,
mlp, ...) and adds: recent/baseline.water_fraction_mndwi/_mlp,
method_agreement_iou, reference, new_water_fraction; top-level flood,
confidence, reference, calibration.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

import numpy as np

from . import calibration, confidence, indices, masks, stac

MAX_PAD_DEG = 0.15
DEFAULT_PAD_DEG = 0.12


def _round(x: float | None, n: int = 4) -> float | None:
    return None if x is None else round(float(x), n)


def compute_scene(bands: dict[str, np.ndarray], offset: int,
                  ref: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, np.ndarray]]:
    """Pure-numpy core: bands (DN) -> metrics + masks. No IO; unit-tested."""
    g, nir, swir, red, blue = (indices.to_reflectance(bands[b], offset) for b in ("B03", "B08", "B11", "B04", "B02"))
    nd, mnd, nv = indices.ndwi(g, nir), indices.mndwi(g, swir), indices.ndvi(nir, red)
    clear = masks.clear_mask(bands["SCL"], g, nir, swir)
    clear_n = int(clear.sum())
    if clear_n == 0:
        raise RuntimeError("No clear pixels after SCL mask")

    mndwi_mask = masks.threshold_mask(mnd, calibration.PRIMARY_MNDWI_THRESHOLD, clear)
    ndwi_mask = masks.threshold_mask(nd, masks.NDWI_THRESHOLD, clear)
    pos, neg = masks.weak_labels(nd, mnd, nv, clear)
    feats = masks.feature_stack(g, nir, swir, red, blue, nd, mnd, nv)
    mlp_flat, mlp_meta = masks.train_mlp(feats, pos.ravel(), neg.ravel())
    mlp_mask = None if mlp_flat is None else (mlp_flat.reshape(clear.shape) & clear)
    water, method_name, miou = calibration.select_water_mask(mndwi_mask, mlp_mask, clear)

    perm = None
    reference: dict[str, Any] | None = None
    if ref is not None:
        occ, wc = ref.get("jrc_occurrence"), ref.get("worldcover")
        layers = []
        if occ is not None:
            layers.append(np.nan_to_num(occ, nan=0) >= calibration.JRC_PERMANENT_OCCURRENCE)
        if wc is not None:
            layers.append(np.nan_to_num(wc, nan=0) == calibration.WORLDCOVER_WATER_CLASS)
        if layers:
            perm = np.logical_or.reduce(layers)
            agr = calibration.agreement(water, perm, clear)
            reference = {
                "ref_fraction": agr["ref_fraction"],
                "precision": agr["precision"],
                "recall": agr["recall"],
                "iou": agr["iou"],
            }

    ndwi_clear = nd[clear]
    summary = {
        "clear_pixel_fraction": float(clear_n / clear.size),
        "ndwi_mean": float(np.nanmean(ndwi_clear)),
        "ndwi_p90": float(np.nanpercentile(ndwi_clear, 90)),
        "mndwi_mean": float(np.nanmean(mnd[clear])),
        "water_fraction": float(water.sum() / clear_n),
        "water_fraction_mndwi": float(mndwi_mask.sum() / clear_n),
        "water_fraction_ndwi_only": float(ndwi_mask.sum() / clear_n),
        "water_fraction_mlp": None if mlp_mask is None else float(mlp_mask.sum() / clear_n),
        "method_agreement_iou": miou,
        "valid_pixels": clear_n,
        "model": method_name,
        "mlp": {**mlp_meta, "role": "cross-check"},
        "threshold_ndwi": masks.NDWI_THRESHOLD,
        "threshold_mndwi": calibration.PRIMARY_MNDWI_THRESHOLD,
        "reference": reference,
        "new_water_fraction": None if perm is None else float((water & ~perm).sum() / clear_n),
    }
    return summary, {"water": water, "clear": clear}


def _scene(item: Any, bbox: list[float]) -> dict[str, Any]:
    bands, grid = stac.read_s2_scene(item, bbox)
    ref = stac.read_reference_water(grid, bbox)
    have_ref = ref.get("jrc_occurrence") is not None or ref.get("worldcover") is not None
    offset = indices.boa_offset_for(stac.processing_baseline(item))
    summary, _ = compute_scene(bands, offset, ref if have_ref else None)
    return {
        "scene_id": item.id,
        "datetime": item.properties.get("datetime"),
        "cloud_cover_pct": float(item.properties.get("eo:cloud_cover", -1)),
        **summary,
        "processing_baseline": stac.processing_baseline(item),
        "boa_offset_dn": offset,
        "collection": stac.S2_COLLECTION,
        "source": "Microsoft Planetary Computer STAC",
        "bands": ["B02", "B03", "B04", "B08", "B11", "SCL"],
        "_reference_items": ref.get("items", []),
    }


def flood_delta(recent: dict[str, Any], baseline: dict[str, Any] | None) -> dict[str, Any] | None:
    if not baseline:
        return None
    r, b = recent.get("new_water_fraction"), baseline.get("new_water_fraction")
    if r is None or b is None:
        return None
    d = r - b
    return {
        "new_water_fraction_recent": _round(r),
        "new_water_fraction_baseline": _round(b),
        "new_water_delta": _round(d),
        "noise_floor": calibration.NEW_WATER_NOISE_FLOOR,
        "significant": abs(d) >= calibration.NEW_WATER_NOISE_FLOOR,
        "definition": "Share of clear pixels mapped as water outside reference permanent water",
    }


def default_windows(today: dt.date) -> dict[str, str]:
    return {
        "recent_start": (today - dt.timedelta(days=21)).isoformat(),
        "recent_end": today.isoformat(),
        "baseline_start": (today - dt.timedelta(days=60)).isoformat(),
        "baseline_end": (today - dt.timedelta(days=22)).isoformat(),
    }


def validate_payload(payload: dict[str, Any]) -> tuple[float, float, float] | str:
    try:
        lat = float(payload.get("lat", 28.386))
        lon = float(payload.get("lon", -80.742))
        pad = float(payload.get("pad_deg", DEFAULT_PAD_DEG))
    except (TypeError, ValueError):
        return "lat, lon, pad_deg must be numbers"
    if not all(np.isfinite([lat, lon, pad])):
        return "lat, lon, pad_deg must be finite"
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return "lat/lon out of range"
    if pad <= 0 or pad > MAX_PAD_DEG:
        return "pad_deg out of allowed range"
    return lat, lon, pad


def analyze(payload: dict[str, Any], today: dt.date | None = None) -> dict[str, Any]:
    v = validate_payload(payload)
    if isinstance(v, str):
        return {"ok": False, "error": v, "limitations": ["AOI rejected"]}
    lat, lon, pad = v
    bbox = [lon - pad, lat - pad, lon + pad, lat + pad]
    win = {**default_windows(today or dt.date.today()), **{k: payload[k] for k in (
        "recent_start", "recent_end", "baseline_start", "baseline_end") if k in payload}}

    extra: list[str] = []
    method = [
        "Sentinel-2 L2A via Planetary Computer STAC (BOA offset applied for processing baseline >= 04.00)",
        "SCL mask removes cloud/shadow/snow pixels",
        "Water mask = MNDWI (Green-SWIR1) > 0 on clear pixels (calibrated vs JRC GSW / ESA WorldCover)",
        "Weakly-supervised 2-layer MLP (numpy) as an independent cross-check",
        "Flood delta = new water outside reference permanent water, recent vs baseline",
    ]
    recent_items = stac.search(stac.S2_COLLECTION, bbox, f"{win['recent_start']}/{win['recent_end']}", max_cloud=60)
    if not recent_items:
        recent_items = stac.search(stac.S2_COLLECTION, bbox, f"{win['recent_start']}/{win['recent_end']}", max_cloud=95)
        extra.append("Only high-cloud scenes available in recent window")
    if not recent_items:
        return {
            "ok": False,
            "error": "No Sentinel-2 scenes for AOI/window",
            "bbox": bbox,
            "limitations": extra + ["Optical stack unavailable — fall back to gauge/alert fusion"],
            "method": method,
            "confidence": {"level": "low", "reasons": ["No Sentinel-2 scene in the recent window"]},
        }
    recent = _scene(stac.clearest(recent_items), bbox)

    baseline = None
    try:
        b_items = stac.search(stac.S2_COLLECTION, bbox, f"{win['baseline_start']}/{win['baseline_end']}", max_cloud=40)
        if b_items:
            baseline = _scene(stac.clearest(b_items), bbox)
    except Exception as exc:  # noqa: BLE001
        extra.append(f"Baseline compare skipped: {type(exc).__name__}")

    ref_items = recent.pop("_reference_items")
    if baseline:
        baseline.pop("_reference_items", None)
    reference_available = recent.get("reference") is not None
    delta = None
    if baseline:
        delta = {
            "water_fraction_delta": recent["water_fraction"] - baseline["water_fraction"],
            "ndwi_mean_delta": recent["ndwi_mean"] - baseline["ndwi_mean"],
        }
    flood = flood_delta(recent, baseline)
    conf = confidence.assess(recent, baseline, reference_available=reference_available)
    lims = confidence.limitations(recent, baseline, flood, reference_available=reference_available) + extra

    return {
        "ok": True,
        "bbox": bbox,
        "center": {"lat": lat, "lon": lon},
        "recent": recent,
        "baseline": baseline,
        "delta": delta,
        "flood": flood,
        "confidence": conf,
        "reference": {
            "available": reference_available,
            "definition": "JRC GSW occurrence >= 50% OR ESA WorldCover 2021 class 80",
            "items": ref_items,
        },
        "calibration": "pipeline/calibration/results.json",
        "windows": win,
        "method": method,
        "limitations": lims,
    }
