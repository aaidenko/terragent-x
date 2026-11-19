# Technical depth (Track 03)

## Why this is not “a chart on an API”

1. **Live multi-feed ingest** with `Promise.allSettled` isolation (USGS NWIS, NWS alerts, NASA EONET). One feed dying does not kill the company loop.
2. **Sentinel-2 EO factory** (`pipeline/analyze_aoi.py`): Planetary Computer STAC → SCL cloud/shadow mask → NDWI + MNDWI → **weakly-supervised 2-layer MLP** (numpy SGD on spectral features with NDWI/MNDWI weak labels) → baseline vs recent delta → explicit limitations.
3. **Hydro + optical fusion** in briefs: live stage/record thresholds + NDWI metrics + confidence that drops when imagery falls back.
4. **Wildfire clustering** across open EONET incidents (count, acres, centroid) for exposure briefs.
5. **Agent OS** (Grok) orchestrates; Cursor owns the raster factory — same split as a real Earth-intel company.

## Robustness

| Failure | Behavior |
|---------|----------|
| USGS timeout | Continue with NWS/EONET; cached Cocoa briefing if needed |
| No clear Sentinel scene | Brief states imagery fallback + heuristic wet fraction |
| High cloud cover | Keep mask, attach cloud % limitation |
| Peak stage after last clear scene | Limitation: timing mismatch / under-canopy water |

## Public API guards

- Demo session token required for `POST /api/loop`, `/api/eo`, `/api/outreach`
- Per-IP rate limits + single-flight EO worker
- EO `pad_deg` capped at 0.15; lat/lon range-checked
- Auto-send disabled on public loop; errors never return tracebacks/stderr

## Next levers (if more time)

- Sentinel-1 SAR flood extent (all-weather)
- FIRMS VIIRS CSV with `FIRMS_MAP_KEY`
- NBR burn-scar on fire AOIs
- H3 Earth index persistence
- Paid imagery broker quote path when optical fails
