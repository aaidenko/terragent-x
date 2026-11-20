#!/usr/bin/env python3
"""Terragent EO CLI. Usage: python3 pipeline/analyze_aoi.py '{"lat":..,"lon":..}'

Stdout: exactly one JSON object. Tracebacks go to stderr only. The analysis
lives in pipeline/terragent_eo (stac, indices, masks, calibration,
confidence, analyze).
"""

from __future__ import annotations

import json
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main() -> int:
    try:
        payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 else json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("payload must be a JSON object")
        from terragent_eo.analyze import analyze

        result = analyze(payload)
        result.pop("trace", None)
        print(json.dumps(result))
        return 0
    except Exception:  # noqa: BLE001
        sys.stderr.write(traceback.format_exc())
        print(json.dumps({
            "ok": False,
            "error": "EO analysis unavailable",
            "limitations": ["EO pipeline raised — briefs should fall back to gauge/alert fusion"],
        }))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
