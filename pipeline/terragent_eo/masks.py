"""Clear-sky and water masks. Pure numpy, no IO."""

from __future__ import annotations

from typing import Any

import numpy as np

# SCL classes treated as invalid: no data, saturated, dark/shadow, cloud
# shadow, cloud medium/high probability, thin cirrus, snow.
SCL_BAD = (0, 1, 2, 3, 8, 9, 10, 11)

NDWI_THRESHOLD = 0.15  # legacy reporting threshold (water_fraction_ndwi_only)


def clear_mask(scl: np.ndarray, *bands: np.ndarray) -> np.ndarray:
    ok = ~np.isin(scl, SCL_BAD)
    for b in bands:
        ok &= np.isfinite(b)
    return ok


def threshold_mask(index: np.ndarray, threshold: float, clear: np.ndarray) -> np.ndarray:
    with np.errstate(invalid="ignore"):
        return (np.nan_to_num(index, nan=-9.0) > threshold) & clear


def legacy_weak_labels(
    ndwi: np.ndarray, mndwi: np.ndarray, ndvi: np.ndarray, clear: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Original (v1) weak labels. Kept only so calibration can reproduce the
    old behaviour. Known flaw: the top-decile NDWI pixels are always labelled
    water, and negatives are vegetation-only, so bright land/urban/sand pixels
    get no negative examples."""
    vals = ndwi[clear]
    vals = vals[np.isfinite(vals)]
    p95, p90 = (float(np.percentile(vals, 95)), float(np.percentile(vals, 90))) if vals.size else (0.2, 0.15)
    with np.errstate(invalid="ignore"):
        pos = clear & (((ndwi > 0.15) & (mndwi > 0.05)) | (ndwi >= max(p90, 0.05)))
        neg = clear & (ndwi < 0.0) & (mndwi < 0.0) & (ndvi > 0.15)
        if int(pos.sum()) < 40 and vals.size > 100:
            pos = clear & (ndwi >= p95)
    return pos, neg


def weak_labels(
    ndwi: np.ndarray, mndwi: np.ndarray, ndvi: np.ndarray, clear: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """v2 weak labels: absolute spectral rules only (no percentile forcing),
    and negatives cover every confidently-dry surface (vegetation, soil,
    urban, sand), not just vegetation."""
    with np.errstate(invalid="ignore"):
        pos = clear & (mndwi > 0.2) & (ndwi > 0.0)
        neg = clear & (mndwi < -0.15) & ((ndwi < -0.1) | (ndvi > 0.3))
    return pos, neg


def _sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -20, 20)))


def train_mlp(
    features: np.ndarray,
    weak_pos: np.ndarray,
    weak_neg: np.ndarray,
    *,
    hidden: int = 8,
    epochs: int = 60,
    lr: float = 0.08,
    prob_threshold: float = 0.55,
    min_labels: int = 40,
    seed: int = 42,
) -> tuple[np.ndarray | None, dict[str, Any]]:
    """Tiny 2-layer MLP (numpy SGD) trained on weak labels and applied to all
    pixels. Returns (mask or None, meta). None means "not trained"."""
    rng = np.random.default_rng(seed)
    pos_idx = np.flatnonzero(weak_pos)
    neg_idx = np.flatnonzero(weak_neg)
    if len(pos_idx) < min_labels or len(neg_idx) < min_labels:
        return None, {
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
    y = np.concatenate([np.ones(n_pos, np.float32), np.zeros(n_neg, np.float32)])
    order = rng.permutation(len(sel))
    sel, y = sel[order], y[order]
    X = features[sel]
    mu = X.mean(axis=0)
    sigma = X.std(axis=0) + 1e-6
    Xn = (X - mu) / sigma
    d = Xn.shape[1]
    W1 = rng.normal(0, 0.2, size=(d, hidden)).astype(np.float32)
    b1 = np.zeros(hidden, dtype=np.float32)
    W2 = rng.normal(0, 0.2, size=(hidden, 1)).astype(np.float32)
    b2 = np.zeros(1, dtype=np.float32)
    for _ in range(epochs):
        z1 = Xn @ W1 + b1
        a1 = np.maximum(z1, 0)
        p = _sigmoid((a1 @ W2 + b2).ravel())
        err = (p - y) / len(y)
        dW2 = a1.T @ err.reshape(-1, 1)
        db2 = err.sum(keepdims=True)
        dz1 = (err.reshape(-1, 1) @ W2.T) * (z1 > 0)
        W2 -= lr * dW2.astype(np.float32)
        b2 -= lr * db2.astype(np.float32)
        W1 -= lr * (Xn.T @ dz1).astype(np.float32)
        b1 -= lr * dz1.sum(axis=0).astype(np.float32)

    def predict(F: np.ndarray) -> np.ndarray:
        a = np.maximum(((F - mu) / sigma) @ W1 + b1, 0)
        return _sigmoid((a @ W2 + b2).ravel())

    acc = float(((predict(X) >= 0.5) == (y >= 0.5)).mean())
    mask = predict(features) >= prob_threshold
    return mask, {
        "trained": True,
        "hidden": hidden,
        "epochs": epochs,
        "train_acc": round(acc, 4),
        "train_pos": int(n_pos),
        "train_neg": int(n_neg),
        "prob_threshold": prob_threshold,
    }


def feature_stack(*arrays: np.ndarray) -> np.ndarray:
    return np.stack([np.nan_to_num(a, nan=0.0) for a in arrays], axis=-1).reshape(-1, len(arrays))
