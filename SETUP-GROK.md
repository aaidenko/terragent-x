# Your setup checklist (Grok side) — do this now

While Cursor finishes the factory, set this up in the **Grok Bot app**:

## 1. Create five bots
Copy profile text from:

| Bot | File |
|-----|------|
| Terragent CEO | `bots/ceo.md` |
| Terragent Scout | `bots/scout.md` |
| Terragent Analyst | `bots/analyst.md` |
| Terragent Matcher | `bots/matcher.md` |
| Terragent Closer | `bots/closer.md` |

Tip: CEO description should say it **never does the work itself** — only delegates and checks.

## 2. Save the skill
In any bot (usually CEO): save `skills/terragent-ops-loop.md` as skill **`terragent-ops-loop`**.

## 3. Connect apps (if available)
- X (search + optional post/DM)
- Email
- Cursor (so Analyst can launch Cloud Agents)

## 4. Routine (after one manual success)
Ask CEO:

> Every 2 hours, run skill terragent-ops-loop against live Terragent mission control. Draft outreach only. Never send without my approval. If feeds are down, report failure.

Use **Test** on the routine once for the video.

## 5. Demo script (2 min)
1. Open mission control in the browser — Run ops loop.
2. Show live Cocoa / FL flood or EONET fire brief.
3. Show outreach drafts.
4. In Grok: CEO runs the skill / routine Test.
5. Approve one send to your own account (or demo auto-send checkbox).

## Parallel build split
- **You / teammate:** Grok bots + skill + routine + session export scrub.
- **Cursor agent:** app, APIs, playbooks, README, deploy.
