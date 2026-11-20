"""Confidence level, reasons and limitations for an EO result. Pure python:
inputs are the numbers the pipeline computed, nothing is estimated here."""

from __future__ import annotations

import datetime as dt
from typing import Any

from . import calibration

LEVELS = ("low", "medium", "high")


def _parse(ts: str | None) -> dt.datetime | None:
    if not ts:
        return None
    try:
        return dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def assess(
    recent: dict[str, Any],
    baseline: dict[str, Any] | None,
    *,
    reference_available: bool,
    now: dt.datetime | None = None,
) -> dict[str, Any]:
    """Start at high; each issue caps the level. Every reason is a sentence
    built from a measured value so the UI can show it verbatim."""
    now = now or dt.datetime.now(dt.timezone.utc)
    level = 2
    reasons: list[str] = []

    def cap(to: int, why: str) -> None:
        nonlocal level
        level = min(level, to)
        reasons.append(why)

    clear = recent.get("clear_pixel_fraction")
    if clear is not None:
        if clear < 0.4:
            cap(0, f"Only {clear:.0%} of the AOI is cloud/shadow-free")
        elif clear < 0.75:
            cap(1, f"{clear:.0%} of the AOI is cloud/shadow-free")
        else:
            reasons.append(f"{clear:.0%} of the AOI is cloud/shadow-free")

    taken = _parse(recent.get("datetime"))
    if taken is not None:
        age = (now - taken).days
        if age > 30:
            cap(0, f"Recent scene is {age} days old")
        elif age > 10:
            cap(1, f"Recent scene is {age} days old")
        else:
            reasons.append(f"Recent scene is {age} days old")

    miou = recent.get("method_agreement_iou")
    if miou is None:
        cap(1, "MLP cross-check unavailable (too few confident water/land pixels)")
    elif miou < calibration.MIN_METHOD_IOU:
        cap(0 if miou < 0.3 else 1, f"MNDWI and MLP masks disagree (IoU {miou:.2f})")
    else:
        reasons.append(f"MNDWI and MLP masks agree (IoU {miou:.2f})")

    ref = recent.get("reference") or {}
    rec = ref.get("recall")
    if not reference_available:
        cap(1, "Reference permanent-water layer unavailable; delta not separated from permanent water")
    elif rec is not None:
        if rec < calibration.MIN_REFERENCE_RECALL:
            cap(1, f"Mask recovers only {rec:.0%} of reference permanent water")
        else:
            reasons.append(f"Mask recovers {rec:.0%} of reference permanent water")

    if baseline:
        b = _parse(baseline.get("datetime"))
        if b is not None and taken is not None:
            gap = abs((taken - b).days)
            if gap > 60:
                cap(1, f"Baseline and recent scenes are {gap} days apart (seasonal change possible)")
            else:
                reasons.append(f"Baseline and recent scenes are {gap} days apart")
    else:
        cap(1, "No clear baseline scene; change cannot be measured")

    return {"level": LEVELS[level], "reasons": reasons}


def limitations(recent: dict[str, Any], baseline: dict[str, Any] | None,
                flood: dict[str, Any] | None, *, reference_available: bool) -> list[str]:
    out = [
        "Optical imagery cannot see water under cloud, smoke or dense canopy; flooded forest is undercounted",
        "Analysis grid is ~100 m (Sentinel-2 resampled); channels narrower than that are missed",
        "Bright urban surfaces and building shadows can read as water (calibrated false-water rate up to ~1% of pixels)",
    ]
    if reference_available:
        out.append(
            "Flood delta counts only water outside reference permanent water (JRC GSW occurrence >= 50% or ESA WorldCover 2021 water); reference epochs end 2021"
        )
    ref = (recent.get("reference") or {}).get("ref_fraction")
    if ref is not None and ref > 0.05:
        out.append("AOI contains open water; tide, wind setup and lagoon level can shift shorelines between scenes")
    if flood and flood.get("significant") is False:
        out.append("New-water change is within the calibrated noise floor and is not evidence of flooding")
    if recent.get("cloud_cover_pct", 0) > 40:
        out.append(f"Recent scene tile cloud cover {recent['cloud_cover_pct']:.1f}%")
    if not baseline:
        out.append("No clear baseline scene in the prior window")
    return out
