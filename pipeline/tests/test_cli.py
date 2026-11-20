import json
import os
import subprocess
import sys

import pytest

CLI = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "analyze_aoi.py")


def run(arg):
    p = subprocess.run([sys.executable, CLI, arg], capture_output=True, text=True, timeout=60)
    assert p.returncode == 0
    lines = [ln for ln in p.stdout.splitlines() if ln.strip()]
    assert len(lines) == 1
    return json.loads(lines[0]), p.stderr


def test_cli_rejects_large_pad_without_network():
    out, _ = run('{"lat":28.386,"lon":-80.742,"pad_deg":0.2}')
    assert out == {"ok": False, "error": "pad_deg out of allowed range", "limitations": ["AOI rejected"]}


def test_cli_bad_json_is_sanitized():
    out, err = run("{not json")
    assert out["ok"] is False and out["error"] == "EO analysis unavailable"
    assert "Traceback" not in json.dumps(out) and "Traceback" in err


@pytest.mark.network
def test_cli_cape_canaveral_contract():
    out, _ = run('{"lat":28.386,"lon":-80.742}')
    assert out["ok"] is True
    for k in ("bbox", "center", "recent", "baseline", "delta", "method", "limitations", "confidence", "flood"):
        assert k in out
    for k in ("scene_id", "datetime", "water_fraction", "water_fraction_ndwi_only", "ndwi_mean", "model", "mlp"):
        assert k in out["recent"]
    assert out["confidence"]["level"] in ("low", "medium", "high")
    assert out["limitations"]
