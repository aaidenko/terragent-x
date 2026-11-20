"""Pipeline core on synthetic arrays. No network."""

import datetime as dt

import numpy as np
import pytest

from terragent_eo import analyze, calibration, confidence, indices, masks

OFF = indices.BOA_OFFSET_DN


def dn(refl):
    return (np.asarray(refl, dtype="float32") * 10000 + OFF).astype("float32")


def scene(water_rows=16, size=64, scl_bad_rows=0):
    """Top `water_rows` rows are water, rest vegetated land."""
    g = np.full((size, size), 0.08, "float32")
    nir = np.full((size, size), 0.30, "float32")
    swir = np.full((size, size), 0.20, "float32")
    red = np.full((size, size), 0.05, "float32")
    blue = np.full((size, size), 0.04, "float32")
    g[:water_rows] = 0.06
    nir[:water_rows] = 0.02
    swir[:water_rows] = 0.01
    red[:water_rows] = 0.03
    scl = np.full((size, size), 4, "float32")
    scl[:water_rows] = 6
    if scl_bad_rows:
        scl[-scl_bad_rows:] = 9  # cloud high probability
    return {"B03": dn(g), "B08": dn(nir), "B11": dn(swir), "B04": dn(red), "B02": dn(blue), "SCL": scl}


def test_boa_offset_matters():
    g, nir = dn([0.06]), dn([0.02])
    with_off = indices.ndwi(indices.to_reflectance(g, OFF), indices.to_reflectance(nir, OFF))[0]
    no_off = indices.ndwi(indices.to_reflectance(g, 0), indices.to_reflectance(nir, 0))[0]
    assert with_off == pytest.approx(0.5, abs=1e-3)
    assert no_off < 0.15  # the v1 bug: water fails NDWI>0.15 without the offset


def test_boa_offset_for_baselines():
    assert indices.boa_offset_for("05.13") == 1000
    assert indices.boa_offset_for("04.00") == 1000
    assert indices.boa_offset_for("03.01") == 0
    assert indices.boa_offset_for(None) == 1000


def test_reflectance_nodata_and_clamp():
    r = indices.to_reflectance(np.array([0, 500, 1500], "float32"))
    assert np.isnan(r[0]) and r[1] == pytest.approx(indices.MIN_REFLECTANCE) and r[2] == pytest.approx(0.05)


def test_clear_mask_drops_scl_bad():
    s = scene(scl_bad_rows=8)
    g = indices.to_reflectance(s["B03"])
    clear = masks.clear_mask(s["SCL"], g)
    assert clear[-8:].sum() == 0 and clear[:-8].all()


def test_agreement_metrics():
    pred = np.array([1, 1, 0, 0], bool)
    ref = np.array([1, 0, 1, 0], bool)
    a = calibration.agreement(pred, ref, np.ones(4, bool))
    assert a["precision"] == 0.5 and a["recall"] == 0.5 and a["iou"] == pytest.approx(1 / 3, abs=1e-4)
    assert a["outside_ref_fraction"] == 0.25


def test_agreement_handles_empty():
    a = calibration.agreement(np.zeros(4, bool), np.zeros(4, bool), np.ones(4, bool))
    assert a["precision"] is None and a["recall"] is None and a["iou"] is None


def test_mlp_untrained_without_labels():
    feats = np.zeros((100, 3), "float32")
    mask, meta = masks.train_mlp(feats, np.zeros(100, bool), np.ones(100, bool))
    assert mask is None and meta["trained"] is False


def test_compute_scene_exact_fractions():
    s = scene(water_rows=16)
    summary, m = analyze.compute_scene(s, OFF, None)
    assert summary["water_fraction"] == pytest.approx(0.25)
    assert summary["water_fraction_mndwi"] == pytest.approx(0.25)
    assert summary["water_fraction_ndwi_only"] == pytest.approx(0.25)
    assert summary["model"] == "mndwi_scl"
    assert summary["mlp"]["trained"] is True
    assert summary["method_agreement_iou"] == pytest.approx(1.0)
    assert summary["reference"] is None and summary["new_water_fraction"] is None


def test_new_water_excludes_reference_permanent_water():
    s = scene(water_rows=32)  # 50% water
    occ = np.zeros((64, 64), "float32")
    occ[:16] = 90  # reference permanent water = top 25%
    summary, _ = analyze.compute_scene(s, OFF, {"jrc_occurrence": occ, "worldcover": None})
    assert summary["reference"]["ref_fraction"] == pytest.approx(0.25)
    assert summary["reference"]["recall"] == 1.0
    assert summary["reference"]["ref_pixels"] == 16 * 64
    assert summary["new_water_fraction"] == pytest.approx(0.25)


def test_flood_delta_and_noise_floor():
    f = analyze.flood_delta({"new_water_fraction": 0.105}, {"new_water_fraction": 0.1})
    assert f["significant"] is False and f["new_water_delta"] == pytest.approx(0.005)
    f = analyze.flood_delta({"new_water_fraction": 0.2}, {"new_water_fraction": 0.1})
    assert f["significant"] is True
    assert analyze.flood_delta({"new_water_fraction": 0.2}, None) is None


@pytest.mark.parametrize("payload,err", [
    ({"lat": 28, "lon": -80, "pad_deg": 0.16}, "pad_deg out of allowed range"),
    ({"lat": 28, "lon": -80, "pad_deg": 0}, "pad_deg out of allowed range"),
    ({"lat": 91, "lon": -80}, "lat/lon out of range"),
    ({"lat": "x", "lon": -80}, "lat, lon, pad_deg must be numbers"),
    ({"lat": float("nan"), "lon": -80}, "lat, lon, pad_deg must be finite"),
])
def test_pad_and_input_validation(payload, err):
    out = analyze.analyze(payload)
    assert out["ok"] is False and out["error"] == err


def test_pad_upper_bound_accepted():
    assert analyze.validate_payload({"lat": 28, "lon": -80, "pad_deg": 0.15}) == (28.0, -80.0, 0.15)


NOW = dt.datetime(2026, 11, 19, tzinfo=dt.timezone.utc)


def good_recent(**kw):
    r = {"clear_pixel_fraction": 0.95, "datetime": "2026-11-15T16:00:00Z", "method_agreement_iou": 0.9,
         "reference": {"recall": 0.95, "ref_fraction": 0.3}, "cloud_cover_pct": 2.0}
    r.update(kw)
    return r


BASE = {"datetime": "2026-10-20T16:00:00Z"}


def test_confidence_high_when_everything_agrees():
    c = confidence.assess(good_recent(), BASE, reference_available=True, now=NOW)
    assert c["level"] == "high" and len(c["reasons"]) == 5


@pytest.mark.parametrize("kw,level", [
    ({"clear_pixel_fraction": 0.3}, "low"),
    ({"clear_pixel_fraction": 0.6}, "medium"),
    ({"datetime": "2026-10-01T00:00:00Z"}, "low"),
    ({"method_agreement_iou": 0.5}, "medium"),
    ({"method_agreement_iou": 0.1}, "low"),
    ({"method_agreement_iou": None}, "medium"),
    ({"reference": {"recall": 0.5, "ref_fraction": 0.3}}, "medium"),
    ({"reference": {"recall": 0.01, "ref_fraction": 0.02, "ref_pixels": 225}}, "low"),
    ({"reference": {"recall": 0.01, "ref_fraction": 0.001, "ref_pixels": 20}}, "high"),
])
def test_confidence_downgrades(kw, level):
    assert confidence.assess(good_recent(**kw), BASE, reference_available=True, now=NOW)["level"] == level


def test_confidence_no_baseline_or_reference():
    c = confidence.assess(good_recent(), None, reference_available=False, now=NOW)
    assert c["level"] == "medium"
    assert any("baseline" in r for r in c["reasons"]) and any("Reference" in r for r in c["reasons"])


def test_limitations_always_populated():
    lims = confidence.limitations(good_recent(), BASE, {"significant": False}, reference_available=True)
    assert any("cloud" in x for x in lims)
    assert any("permanent water" in x for x in lims)
    assert any("tide" in x for x in lims)
    assert any("noise floor" in x for x in lims)


def test_default_windows_are_relative():
    w = analyze.default_windows(dt.date(2026, 11, 19))
    assert w == {"recent_start": "2026-10-29", "recent_end": "2026-11-19",
                 "baseline_start": "2026-09-20", "baseline_end": "2026-10-28"}
