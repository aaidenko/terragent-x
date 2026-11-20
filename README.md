# TerragentX

**Live: [terragentx.apps.grok.bot](https://terragentx.apps.grok.bot/)** · Mission control: [terragentx.apps.grok.bot/mission](https://terragentx.apps.grok.bot/mission)

> **Note for judges:** we're submitting **both a demo video and a live demo link**. The video shows the full capabilities end to end, including the Grok Bot agents operating mission control with computer use. The live link lets you test it yourself: open [mission control](https://terragentx.apps.grok.bot/mission), click **Run ops loop**, and open any signal to see its verified brief.

**Ask about any place on Earth, or we'll come to you with the answer.**

TerragentX is an agent-run Earth intelligence company. It reads live public Earth-observation and hazard data, turns it into verified briefs, finds the people and businesses in the path, and drafts outreach that a human approves before anything is sent.

Built at the Berkeley × Stanford Grok Bot Hackathon for **Track 03, Most Technically Complex**: make live public space data useful to people on the ground.

| | |
|---|---|
| Live site | https://terragentx.apps.grok.bot/ |
| Demo video | _link added at submission_ |
| Presentation | Canva deck: https://www.canva.com/d/NnwCc2odxBce6zg |
| Grok Bot session export | `grok/session-export/` (personal info removed) |
| Repo | https://github.com/aaidenko/terragent-x |

---

## Inspiration

In November 2026 the St. Johns River near Cocoa, Florida rose above its all-time record and water entered homes in Lake Poinsett, Silver Pines and Shakespeare Park. Every number that mattered was already public: the USGS gauge updates every 15 minutes, the National Weather Service publishes flood warnings, and NASA tracks open wildfires and storms worldwide. The people in the path still heard about it last, through fragments, after the fact.

Public space and Earth data is abundant, free and current. What's missing is someone who reads it continuously, works out what it means for a specific place, and tells the right people first. We built a company of agents to do exactly that.

## What it does

Each **ops loop** runs end to end on live data:

1. **Scout** reads three public feeds on every pass:
   - **USGS NWIS** instantaneous values for the St. Johns River near Cocoa (gauge 02232000), compared against flood stage (16 ft) and the record (17.6 ft).
   - **NWS** active Florida flood alerts from `api.weather.gov`.
   - **NASA EONET** open events, filtered to wildfires, severe storms and floods.
2. **Analyst** runs a **Sentinel-2 Earth-observation stack** on each area of interest through Microsoft Planetary Computer: an SCL cloud and shadow mask, NDWI and MNDWI water indices, and a weakly supervised NumPy MLP water classifier calibrated against JRC surface water and ESA WorldCover. It fuses that with the live hydro signal into a verified brief: headline, finding, method, metrics, confidence and stated limitations. When clouds or missing scenes block the imagery, it falls back cleanly and says so. Wildfire signals are clustered from open EONET incidents.
3. **Matcher** attaches reachable businesses and organisations near the area of interest, with a fit score.
4. **Closer** drafts X and email outreach that cites the signal and the method, plus public **@Terragent** broadcast posts. Everything waits for **human approval**; nothing is sent automatically.

A **CEO agent on Grok Bot** coordinates the four workers, runs the loop on a routine, and drives the mission control web app with computer use.

**Markets (playbooks):** Disasters & property (live), Wildfire & burn scar (live), Deforestation compliance (ready), Mine expansion (ready), Private data brokerage (roadmap).

### Earth observation

Mission loop calls this automatically. `POST /api/eo` runs the water analysis for an arbitrary lat/lon.

Water mask = MNDWI > 0 on SCL-clear pixels (Sentinel-2 BOA offset applied), calibrated against JRC Global Surface Water and ESA WorldCover. Flood delta is new water outside reference permanent water. Every result carries `confidence {level, reasons}` and `limitations`. See [docs/EO-CALIBRATION.md](docs/EO-CALIBRATION.md); re-run with `python3 pipeline/calibrate.py`.

### Checks

```bash
python3 -m pip install -r pipeline/requirements-dev.txt
npm run check   # lint, typecheck, vitest API tests, pytest pipeline tests, build
```

`pytest --network` (or `TERRAGENT_NETWORK_TESTS=1`) adds a live Planetary Computer smoke test. CI (`.github/workflows/check.yml`) runs `npm run check` with no secrets.

### Mission control

`/mission` is the instrument panel for the loop:

- **Run ops loop** starts a pass, and the steps stream in as each agent works.
- A **dot-matrix world map** (Equal Earth projection) plots every signal. Critical ones pulse.
- **Feed health** reports each source as live, quiet or fallback for the current pass, with the latest observation time and endpoint.
- **Signals** are sorted by severity. Selecting one opens its full record: raw reading, coordinates, source link and provenance, plus the brief (method, confidence, limitations), matched contacts and drafts.
- **Outreach** can be approved one draft at a time or all at once, and **@Terragent broadcasts** have their own approval queue.
- Each visitor gets their own **demo session**: public signals are shared, while briefs, queues and approvals are scoped to the session.

## How we built it (tech stack)

| Layer | What we used |
|---|---|
| App | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS v4 with a custom token system (see `DESIGN.md`), Base UI primitives through shadcn |
| Motion | `motion` for line-mask type reveals and staggered reveals; CSS keyframes for first paint |
| Map | `d3-geo` + `topojson-client` + `world-atlas`. The land dot matrix is computed on the server; markers are projected on the client with the same Equal Earth projection. |
| Data | USGS NWIS IV, NWS Alerts API, NASA EONET v3 (all fetched live with `no-store`), Sentinel-2 L2A via Microsoft Planetary Computer STAC |
| EO pipeline | Python (`pipeline/terragent_eo`): STAC search, SCL masking, NDWI/MNDWI, NumPy MLP water classifier, calibration against JRC/WorldCover (`pipeline/calibration/results.json`), pytest suite |
| App pipeline | `src/lib/signals.ts` (ingest + normalisation, per-feed failure isolation), `eo.ts` (EO bridge), `analysis.ts` (briefs), `outreach.ts` (matching, drafts, broadcasts), `loop.ts` (orchestration), session-scoped store |
| Security | HMAC-signed demo sessions, per-session queues, per-IP rate limits, fail-closed when the host secret is missing (`src/lib/security.ts`) |
| Agents | Grok Bot: CEO + Scout, Analyst, Matcher, Closer, with the `terragent-ops-loop` skill, a routine and computer use (`bots/`, `grok/`, `skills/`) |
| Imagery | Public-domain NASA (ISS, Earth Observatory) and USGS Landsat scenes, graded to black and white by `scripts/grade-imagery.mjs` (sharp) |
| Deployment | Grok Bot app hosting at `terragentx.apps.grok.bot` |

The UI is designed in the same language as our pitch deck: monochrome, one signal color reserved for live and critical hazards, giant regular-weight type, hairlines and frosted glass. The rules are written down in [`DESIGN.md`](DESIGN.md).

## Challenges we ran into

- **Feeds that flap.** The USGS gauge read sometimes returns empty or sentinel values. Instead of dropping the flagship site, the pipeline falls back to a clearly labeled snapshot from the NWS briefing. The UI marks it "Fallback snapshot" everywhere it appears, so nobody mistakes it for a live read.
- **Mismatched schemas.** USGS time series, NWS GeoJSON alerts and EONET event geometries all describe "something happening somewhere" in different shapes. Everything is normalised into one `SignalEvent` with severity, coordinates, source, timestamp and metrics.
- **Clouds over the flood.** Optical imagery is often useless exactly when it matters. The EO stack masks clouds and shadows per pixel with Sentinel-2's scene classification, reports cloud cover and scene date in the brief, and drops back to the hydro-only brief instead of guessing. A Sentinel-2 surface reflectance offset bug in newer processing baselines also had to be corrected before the water mask calibrated against JRC and WorldCover.
- **A public demo that can't be abused.** Anyone can open the live site, so runs are rate-limited, approvals are scoped to a signed session, and the server refuses to auto-send.
- **Alerts without points.** NWS alerts describe areas, not coordinates. Until polygon centroids are added, they're pinned to a regional default and marked as approximate on the map and in the detail panel.
- **Not waiting on the planet.** Upstream feeds can take seconds. The landing page paints immediately and streams live numbers in behind Suspense, with a timeout and a five-minute shared cache.
- **Keeping humans in charge.** Outreach is drafted automatically but only sent on approval, either per draft or in bulk, with an explicit demo auto-send switch.

## Accomplishments that we're proud of

- A full loop (ingest, analyse, match, draft) running on current public data, with no mock files.
- A real Sentinel-2 water-detection stack (masking, indices and an MLP classifier) calibrated against independent reference maps, with tests.
- Honest provenance: every signal carries its source, timestamp and coordinates, and fallbacks and approximations are labeled instead of hidden.
- A five-agent company on Grok Bot that can run the whole loop through computer use.
- A site that looks and feels like the deck, from the strips and glass to the type scale.

## What we learned

- Public Earth data is good enough to act on. The hard part is reliability and interpretation, not access.
- Robustness is a product feature. Showing which feed is quiet, and why, builds more trust than a perfect-looking dashboard.
- Agents are most useful with a narrow job each and a human gate where it matters.

## What's next

- Add NASA FIRMS hotspots and NOAA SWPC space weather to the Scout.
- Compute real centroids and impact areas from NWS alert polygons.
- Persist passes, briefs and approvals in a database instead of memory.
- Extend the EO stack to burn-scar (NBR) and forest-loss change detection.
- Bring the Deforestation and Mining playbooks live with Sentinel-2 change detection.
- Private data brokerage: when free imagery is clouded out, quote paid scenes and sell the answer.
- Let anyone ask about a specific place and get a brief back.

## How Grok Bot helped build it

- **Ran the company.** Five Grok Bots (CEO, Scout, Analyst, Matcher, Closer) are defined in `bots/` and `grok/profiles/`, with a one-paste installer in `grok/PASTE-THIS-TO-GROK.md`.
- **Operated the product.** With computer use, the CEO opens mission control, clicks **Run ops loop**, reads the briefs and posts a digest. The `terragent-ops-loop` skill and a routine make that repeatable.
- **Researched.** Scout and Matcher use the browser and X to find ground truth and reachable businesses near each area of interest.
- **Engineered.** A Terragent Engineer Grok Bot took over coding hand-offs, built the EO factory and API hardening, and the app is deployed from the Grok Bot environment.

The full session export is in `grok/session-export/`.

## How to run it

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
# open http://127.0.0.1:3847, then /mission and click "Run ops loop"
```

Production build:

```bash
npm run build
npm start          # serves on http://127.0.0.1:3847
```

EO pipeline (Python 3, called automatically by the loop):

```bash
python3 -m pip install -r pipeline/requirements.txt
python3 pipeline/analyze_aoi.py '{"lat":28.386,"lon":-80.742}'
python3 -m pytest            # pipeline tests
```

### Host configuration

| Env var | Required | Purpose |
|---------|----------|---------|
| `TERRAGENT_SESSION_SECRET` | **Yes** | HMAC key for demo session tokens. Random, at least 32 characters (`openssl rand -hex 32`). There is no built-in fallback: if it is missing (and no host `CURSOR_APP_SECRET` of 32+ chars exists), `POST /api/session` returns 503 and every gated `POST` returns 401. | Keep it in the host's secret settings, never in the repo.
| `TERRAGENT_PYTHON` | No (default `python3`) | Python interpreter for the EO pipeline; point it at a venv that has `pipeline/requirements.txt` installed. |
| `TRUSTED_PROXY_HOPS` | No (default `1`) | Number of trusted reverse proxies in front of the app. The rate-limit client IP is read that many entries from the **right** of `X-Forwarded-For`, so client-supplied values are ignored. Set `0` if no proxy sets the header (all callers then share one strict bucket). |
| `NEXT_PUBLIC_SITE_URL` | No | Deployed origin for social preview links (defaults to the live site). |

### API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/signals` | Read live signals (rate-limited per client IP) |
| `POST` | `/api/session` | Start a demo session; send the token as `x-terragent-session` |
| `GET` | `/api/loop` | Mission state: public events plus your session's briefs, queues and loops |
| `POST` | `/api/loop` | Run an ops loop `{ maxEvents?, skipImagery? }` (session required) |
| `POST` | `/api/outreach` | Approve your session's drafts `{ ids? }` (all when omitted) |
| `POST` | `/api/broadcast` | Approve your session's @Terragent broadcast drafts `{ ids? }` |
| `POST` | `/api/eo` | Sentinel-2 water analysis for a lat/lon, `pad_deg` ≤ 0.15 (session required) |
| `GET` | `/api/playbooks` | Market playbooks |

### Grok Bot setup

Paste `grok/PASTE-THIS-TO-GROK.md` into a new Grok Bot, or set up each profile in `bots/` by hand and save `skills/terragent-ops-loop.md` as a skill. See [`SETUP-GROK.md`](SETUP-GROK.md) and [`grok/INSTALL.md`](grok/INSTALL.md).

## Team

Aiden Ko · Thomas Wang

## Credits

Satellite imagery: NASA Johnson Space Center, NASA Earth Observatory and USGS EROS (public domain). See `public/imagery/CREDITS.md`. Live data: USGS National Water Information System, NOAA National Weather Service, NASA EONET.
