"""Agreement metrics between a water mask and a reference water mask, and the
method-selection rule derived from the calibration run. Numpy only."""

from __future__ import annotations

from typing import Any

import numpy as np

# Reference definitions (documented in docs/EO-CALIBRATION.md)
JRC_PERMANENT_OCCURRENCE = 50  # % of 1984-2021 observations that were water
WORLDCOVER_WATER_CLASS = 80  # "Permanent water bodies"


def agreement(pred: np.ndarray, ref: np.ndarray, valid: np.ndarray) -> dict[str, Any]:
    """Precision / recall / IoU of `pred` vs `ref` over `valid` pixels."""
    pred = np.asarray(pred, bool) & valid
    ref = np.asarray(ref, bool) & valid
    n = int(valid.sum())
    tp = int((pred & ref).sum())
    fp = int((pred & ~ref).sum())
    fn = int((~pred & ref).sum())

    def ratio(a: int, b: int) -> float | None:
        return round(a / b, 4) if b > 0 else None

    return {
        "valid_pixels": n,
        "pred_fraction": ratio(int(pred.sum()), n),
        "ref_fraction": ratio(int(ref.sum()), n),
        "precision": ratio(tp, tp + fp),
        "recall": ratio(tp, tp + fn),
        "iou": ratio(tp, tp + fp + fn),
        # water called outside the permanent reference, as a share of valid
        # pixels: on a dry baseline scene this is the false "new water" rate
        # that would leak into a flood delta.
        "outside_ref_fraction": ratio(fp, n),
    }


def mask_iou(a: np.ndarray, b: np.ndarray, valid: np.ndarray) -> float | None:
    a = np.asarray(a, bool) & valid
    b = np.asarray(b, bool) & valid
    union = int((a | b).sum())
    if union == 0:
        return 1.0
    return round(int((a & b).sum()) / union, 4)


# Calibrated choices (pipeline/calibration/results.json, docs/EO-CALIBRATION.md)
PRIMARY_METHOD = "mndwi_scl"
PRIMARY_MNDWI_THRESHOLD = 0.0
# Largest share of valid pixels that MNDWI>0 called water outside permanent
# reference water on a calibration baseline scene (Phoenix urban control).
# New-water changes smaller than this are reported as "within noise".
NEW_WATER_NOISE_FLOOR = 0.01
# Method agreement (IoU MNDWI vs MLP-v2) below this lowers confidence.
MIN_METHOD_IOU = 0.6
# Recall of reference permanent water below this means the scene is missing
# water we know is there (haze, glint, turbidity, misregistration).
MIN_REFERENCE_RECALL = 0.7
# Below this recall the mask is missing most known water: low confidence.
LOW_REFERENCE_RECALL = 0.3
# Fewer clear reference-water pixels than this and recall is not meaningful.
MIN_REFERENCE_PIXELS = 100


def select_water_mask(
    mndwi_mask: np.ndarray, mlp_mask: np.ndarray | None, valid: np.ndarray
) -> tuple[np.ndarray, str, float | None]:
    """MNDWI>0 on SCL-clear pixels is always the reported mask. The v2 MLP is
    a cross-check only: its IoU with the primary feeds confidence, it never
    overrides the primary. Returns (mask, method_name, method_iou)."""
    if mlp_mask is None:
        return mndwi_mask, PRIMARY_METHOD, None
    return mndwi_mask, PRIMARY_METHOD, mask_iou(mndwi_mask, mlp_mask, valid)
