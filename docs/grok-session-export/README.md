# Terragent — scrubbed Grok Bot session export

**Event:** Berkeley x Stanford Grok Bot Hackathon  
**Track:** 03 · Most Technically Complex  
**Project:** Terragent, an Earth-intelligence app  
**Live demo:** https://terragentx.apps.grok.bot  
**Export timezone:** Pacific Time (America/Los_Angeles, UTC-8 on 19 Nov 2026)

This packet is a fallback session export. Organizers said they would show the official export method at kickoff. Judges can use these files to see how Grok Bot helped plan, build, and debug Terragent. Personal names, emails, phone numbers, API keys, tokens, and credentials have been removed or replaced with placeholders. The human operator's name is replaced with **Human operator**. The @Terragent brand handle is kept.

## What Terragent is

Terragent turns live public Earth-observation and hazard data into something people on the ground can use. The stack is:

- **Next.js mission control** — a deployed web app at the live demo URL, with a loop API, session gates, and rate limits.
- **Python EO pipeline** (`pipeline/analyze_aoi.py`) — Sentinel-2 SCL masking, NDWI/MNDWI water indices, and an MLP water classifier.
- **A six-bot Grok Bot company** that runs an ops loop: Scout pulls live events, Analyst writes EO briefs, Matcher finds prospects, Closer drafts outreach, the CEO collects a digest, and Engineer owns the code. Outreach, X posts, payments, and merges stay at L1 drafts until the human operator says Approve. Gauge and NDWI numbers are never invented.

## How the bot team built it

1. **Company setup.** Terragent Setup turned a paste-in brief into a six-bot roster, profiles, and operating rules, then coordinated work across the team.
2. **Security hardening.** Engineer and Setup shipped a security fix to Cursor Origin `main` as commit `e619458`: no HMAC fallback, `/api/signals` limited to 6 requests per minute, `X-Forwarded-For` trust bounded by `TRUSTED_PROXY_HOPS`, per-session state, `GET /api/loop` limited to 30 requests per minute, and sanitized loop errors. The GitHub mirror was brought to the same commit. Later, at the human operator's request, commit authors were rewritten so Cursor Agent would not appear as a GitHub contributor; both remotes' `main` then pointed at `68d1d1f` with the same file tree as `e619458`.
3. **EO pipeline.** The factory already runs Sentinel-2 water detection. A later request from the human operator was to go deeper on EO (including calibrating a mask disagreement at Cape Canaveral: MLP 0.366 vs NDWI 0.00056) and strengthen the tech stack without overwriting the human operator's latest pushes.
4. **Ops loop.** The CEO ran `terragent-ops-loop` end to end on 19 Nov 2026 from 3:25 to 3:47 PM Pacific Time (run `loop-5qduspr`): 28 events ingested, 3 briefs written, outreach drafts queued. Nothing was sent; the digest is waiting for Approve. Closer also drafted an @Terragent broadcast from the live flood brief.
5. **Autonomy rules observed.** No email was sent, no X post or DM was published, no payment was made, and no merge was performed without Approve.

## Sessions in this export

| File | Session | Included? | Notes |
| --- | --- | --- | --- |
| [terragent-setup.md](terragent-setup.md) | Terragent Setup | Yes (spoken messages) | 68 messages with timestamps. Tool traces were not available from the helper run that built this export; see the file header. |
| [terragent-ceo.md](terragent-ceo.md) | Terragent CEO · Earth intelligence company lead | Yes | 31 human/inbound + 57 bot messages, 47 tool-action notes. |
| [terragent-scout.md](terragent-scout.md) | Terragent Scout · Live signal hunter | Yes | 3 human/inbound + 14 bot messages, 9 tool-action notes. |
| [terragent-analyst.md](terragent-analyst.md) | Terragent Analyst · EO brief factory operator | Yes | 7 human/inbound + 23 bot messages, 20 tool-action notes. |
| [terragent-matcher.md](terragent-matcher.md) | Terragent Matcher · Prospect finder | Yes | 3 human/inbound + 12 bot messages, 9 tool-action notes. |
| [terragent-closer.md](terragent-closer.md) | Terragent Closer · Outreach drafter | Yes | 8 human/inbound + 26 bot messages, 19 tool-action notes. |
| [terragent-engineer.md](terragent-engineer.md) | Terragent Engineer · Factory developer | Yes | 17 human/inbound + 43 bot messages, 42 tool-action notes. |
| [terragent-company.md](terragent-company.md) | Terragent Company (group) | No transcript recorded | ReadTranscript reported that this group had no recorded transcript yet. |

Also included:

- [session-export.md](session-export.md) — all of the session files combined into one document.
- [grok-session-export.zip](grok-session-export.zip) — the same files zipped for submission.

## Scrubbing

The export was swept for emails, phone numbers, known key/token prefixes (`sk-`, `xai-`, `key_`, `gho_`/`ghp_`, `x-access-token`, Bearer, JWT, `CURSOR_API_KEY` assignments), long high-entropy strings, personal names, personal GitHub/Origin usernames, and the real Cursor API key stored on the Bot computer (the key itself is not included here). Public commit `e619458`, bot agent IDs, and the @Terragent brand handle were kept on purpose.

## How to read this

Start with this README, then [terragent-setup.md](terragent-setup.md) for the plan and coordination, [terragent-engineer.md](terragent-engineer.md) for the code and EO/security work, and [terragent-ceo.md](terragent-ceo.md) plus Scout, Analyst, Matcher, and Closer for the live ops loop. Times are in Pacific Time.

