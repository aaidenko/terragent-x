# Technical depth (Track 03)

## Why this is not “a chart on an API”

1. **Live multi-feed ingest** with `Promise.allSettled` isolation (USGS NWIS, NWS alerts, NASA EONET). One feed dying does not kill the company loop.
2. **Sentinel-2 NDWI factory** (`pipeline/analyze_aoi.py`): Planetary Computer STAC search → sign COGs → warp AOI into UTM → read Green/NIR windows → NDWI water mask → baseline vs recent delta → explicit cloud/timing limitations.
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

## Next levers (if more time)

- Sentinel-1 SAR flood extent (all-weather)
- FIRMS VIIRS CSV with `FIRMS_MAP_KEY`
- NBR burn-scar on fire AOIs
- H3 Earth index persistence
- Paid imagery broker quote path when optical fails
