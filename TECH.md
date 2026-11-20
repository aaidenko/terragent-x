# Technical depth (Track 03)

## Why this is not “a chart on an API”

1. **Live multi-feed ingest** with `Promise.allSettled` isolation (USGS NWIS, NWS alerts, NASA EONET). One feed dying does not kill the company loop.
2. **Sentinel-2 EO factory** (`pipeline/terragent_eo/`, CLI `pipeline/analyze_aoi.py`): Planetary Computer STAC → BOA-offset-corrected reflectance → SCL cloud/shadow mask → **MNDWI water mask calibrated against JRC GSW + ESA WorldCover** (docs/EO-CALIBRATION.md) → weakly-supervised numpy MLP as an independent cross-check → **new water outside reference permanent water**, recent vs baseline, with a measured 1% noise floor → confidence level with reasons + explicit limitations.
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

- Demo session token (HMAC, 1 h TTL) required for every `POST` (`/api/loop`, `/api/eo`, `/api/outreach`, `/api/broadcast`)
- Session key comes only from host env `TERRAGENT_SESSION_SECRET` (≥ 32 chars; a host `CURSOR_APP_SECRET` is accepted as a domain-separated alternative). No hardcoded fallback: missing secret ⇒ sessions refused (fail closed)
- Per-session state: briefs, prospects, outreach + broadcast approval queues, and loop runs are scoped to the session that created them; only public hazard events are shared
- Per-IP rate limits on every route, including `GET /api/signals`; single-flight EO worker
- Client IP for rate limits = `X-Forwarded-For` entry `TRUSTED_PROXY_HOPS` (default 1) from the right, so spoofed/prepended entries cannot mint new buckets
- EO `pad_deg` capped at 0.15; lat/lon range-checked
- Auto-send disabled on public loop; errors never return tracebacks/stderr

## Next levers (if more time)

- Sentinel-1 SAR flood extent (all-weather)
- FIRMS VIIRS CSV with `FIRMS_MAP_KEY`
- NBR burn-scar on fire AOIs
- H3 Earth index persistence
- Paid imagery broker quote path when optical fails
