# Terragent X

**Ask about any place on Earth, or we'll come to you with the answer.**

Earth intelligence company for the Berkeley × Stanford Grok Bot Hackathon — **Most Technically Complex** track (public space / EO data → help people on the ground).

Grok Bot runs the autonomous company (CEO + Scout + Analyst + Matcher + Closer).  
Cursor builds the factory: live USGS / NWS / NASA EONET ingest, multi-market playbooks, mission control, outreach queue.

> Descended from [Terragent](https://github.com/lapark714/terragent) (Naïve Autonomous Company Hackathon).

## What it does

1. **Scout** pulls live public hazard / EO signals (flood gauges, NWS alerts, EONET wildfires/storms).
2. **Analyst** writes verified briefs (gauge thresholds, wet-fraction / fire buffer heuristics, methods + limitations).
3. **Matcher** attaches reachable businesses near the AOI.
4. **Closer** drafts X + email outreach (approve to mark sent; optional demo auto-send).

**Markets:** disasters (live), wildfire (live), deforestation (ready), mining (ready), private data brokerage (roadmap).

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
