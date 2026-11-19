# Terragent X

**Ask about any place on Earth, or we'll come to you with the answer.**

Earth intelligence company for the Berkeley × Stanford Grok Bot Hackathon — **Most Technically Complex** track (public space / EO data → help people on the ground).

Grok Bot runs the autonomous company (CEO + Scout + Analyst + Matcher + Closer).  
Cursor builds the factory: live USGS / NWS / NASA EONET ingest, multi-market playbooks, mission control, outreach queue.

> Descended from [Terragent](https://github.com/lapark714/terragent) (Naïve Autonomous Company Hackathon).

## What it does

1. **Scout** pulls live public hazard / EO signals (flood gauges, NWS alerts, EONET wildfires/storms) with per-feed failure isolation.
2. **Analyst** runs a real **Sentinel-2 NDWI** water mask via Microsoft Planetary Computer (Python/rasterio), fuses it with live USGS/NWS hydro signals, and falls back cleanly when clouds/scenes fail. Wildfire path clusters open EONET incidents.
3. **Matcher** attaches reachable businesses near the AOI.
4. **Closer** drafts X + email outreach (approve to mark sent; optional demo auto-send).

**Markets:** disasters (live + NDWI), wildfire (live cluster), deforestation (ready), mining (ready), private data brokerage (roadmap).

### EO pipeline

```bash
python3 -m pip install -r pipeline/requirements.txt
python3 pipeline/analyze_aoi.py '{"lat":28.386,"lon":-80.742}'
```

Mission loop calls this automatically. `POST /api/eo` runs NDWI for an arbitrary lat/lon.

## Run locally

```bash
npm install
npm run dev
# http://127.0.0.1:3847
```

```bash
npm run build && npm start -- -p 3847
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/signals` | Refresh live signals |
| `GET` | `/api/loop` | Mission state |
| `POST` | `/api/loop` | Run ops loop `{ autoApprove?, maxEvents? }` |
| `POST` | `/api/outreach` | Approve drafts `{ ids? }` |
| `GET` | `/api/playbooks` | Market playbooks |

## Grok Bot setup

Paste files from `bots/` into five Grok Bots. Save `skills/terragent-ops-loop.md` as a skill. See `SETUP-GROK.md`.

## Hackathon submission notes

- Inspiration · What it does · How we built it · Challenges · Accomplishments · What we learned · What's next · How Grok Bot helped · How to run — covered here + session export.
- Depth: real USGS/NWS/EONET handling, not a chart on a mock file.
- Demo: Mission control → Run ops loop → inspect briefs → Approve drafts / Grok routine.

## Team

Aiden (+ teammates).
