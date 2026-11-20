# Terragent X

**Ask about any place on Earth, or we'll come to you with the answer.**

Earth intelligence company for the Berkeley × Stanford Grok Bot Hackathon — **Most Technically Complex** track (public space / EO data → help people on the ground).

Grok Bot runs the autonomous company (CEO + Scout + Analyst + Matcher + Closer).  
Cursor builds the factory: live USGS / NWS / NASA EONET ingest, multi-market playbooks, mission control, outreach queue.

> Descended from [Terragent](https://github.com/lapark714/terragent) (Naïve Autonomous Company Hackathon).

## What it does

1. **Scout** pulls live public hazard / EO signals (flood gauges, NWS alerts, EONET wildfires/storms) with per-feed failure isolation.
2. **Analyst** runs a **Sentinel-2 EO stack** (SCL mask, NDWI+MNDWI, weakly-supervised numpy MLP water classifier) via Planetary Computer, fuses it with live hydro signals, and falls back cleanly when clouds/scenes fail. Also drafts **@Terragent** X broadcasts. Wildfire path clusters open EONET incidents.
3. **Matcher** attaches reachable businesses near the AOI.
4. **Closer** drafts X + email outreach (approve to mark sent; optional demo auto-send).

**Markets:** disasters (live + NDWI), wildfire (live cluster), deforestation (ready), mining (ready), private data brokerage (roadmap).

### EO pipeline

```bash
python3 -m pip install -r pipeline/requirements.txt
python3 pipeline/analyze_aoi.py '{"lat":28.386,"lon":-80.742}'
```

Mission loop calls this automatically. `POST /api/eo` runs the water analysis for an arbitrary lat/lon.

Water mask = MNDWI > 0 on SCL-clear pixels (Sentinel-2 BOA offset applied), calibrated against JRC Global Surface Water and ESA WorldCover. Flood delta is new water outside reference permanent water. Every result carries `confidence {level, reasons}` and `limitations`. See [docs/EO-CALIBRATION.md](docs/EO-CALIBRATION.md); re-run with `python3 pipeline/calibrate.py`.

## Checks

```bash
python3 -m pip install -r pipeline/requirements-dev.txt
npm run check   # lint, typecheck, vitest API tests, pytest pipeline tests, build
```

`pytest --network` (or `TERRAGENT_NETWORK_TESTS=1`) adds a live Planetary Computer smoke test. CI (`.github/workflows/check.yml`) runs `npm run check` with no secrets.

## Run locally

```bash
npm install
npm run dev
# http://127.0.0.1:3847
```

```bash
npm run build && npm start -- -p 3847
```

## Host configuration (required before Publish)

| Env var | Required | Purpose |
|---------|----------|---------|
| `TERRAGENT_SESSION_SECRET` | **Yes** | HMAC key for demo session tokens. Random, at least 32 characters. There is no built-in fallback: if it is missing (and no host `CURSOR_APP_SECRET` of 32+ chars exists), `POST /api/session` returns 503 and every gated `POST` returns 401. |
| `TERRAGENT_PYTHON` | No (default `python3`) | Python interpreter for the EO pipeline; point it at a venv that has `pipeline/requirements.txt` installed. |
| `TRUSTED_PROXY_HOPS` | No (default `1`) | Number of trusted reverse proxies in front of the app. The rate-limit client IP is read that many entries from the **right** of `X-Forwarded-For`, so client-supplied values are ignored. Set `0` if no proxy sets the header (all callers then share one strict bucket). |

Generate a secret locally with `openssl rand -hex 32` and paste it only into the host's secret settings, never into the repo or chat.

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/signals` | Refresh live signals (rate-limited per client IP) |
| `POST` | `/api/session` | Start a demo session (rate-limited; 503 if the host secret is unset) |
| `GET` | `/api/loop` | Mission state: public events + **your session's** briefs, queues, loops |
| `POST` | `/api/loop` | Run ops loop `{ maxEvents?, skipImagery? }` (session required) |
| `POST` | `/api/outreach` | Approve **your session's** drafts `{ ids? }` (session required) |
| `POST` | `/api/broadcast` | Approve **your session's** @Terragent broadcast drafts `{ ids? }` (session required) |
| `POST` | `/api/eo` | NDWI for a lat/lon, `pad_deg` ≤ 0.15 (session required) |
| `GET` | `/api/playbooks` | Market playbooks |

## Grok Bot setup

Paste files from `bots/` into five Grok Bots. Save `skills/terragent-ops-loop.md` as a skill. See `SETUP-GROK.md`.

## Hackathon submission notes

- Inspiration · What it does · How we built it · Challenges · Accomplishments · What we learned · What's next · How Grok Bot helped · How to run — covered here + session export.
- Depth: real USGS/NWS/EONET handling, not a chart on a mock file.
- Demo: Mission control → Run ops loop → inspect briefs → Approve drafts / Grok routine.

## Team

Aiden (+ teammates).
