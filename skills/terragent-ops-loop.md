# Skill: terragent-ops-loop

## When to use
Human says "run the loop" / "run Terragent" / routine schedule / webhook from factory `analysis complete`.

## Required access
- Web + X search
- Terragent app URL (mission control) or local factory API
- Cursor Cloud Agent (Analyst only, when code/pipeline work needed)
- Email / X send plugins only after approval

## Sequence
1. **Scout** — collect live signals; rank by severity + reachable buyers.
2. **Pick top 1–3** — prefer disasters/wildfire live playbooks.
3. **Analyst** — produce briefs via factory (`POST /api/loop` or equivalent).
4. **Matcher** — 2 prospects per brief minimum.
5. **Closer** — draft X + email for each prospect.
6. **Stop for approval** unless demo auto-send.
7. Log digest to human: event, brief, prospects, drafts, Approve Y/N.

## Validate
- Every numeric claim cites a live source or states heuristic limitation.
- No outreach marked sent without approval path.
- If USGS/NWS/EONET fail: report failure, do not use stale invented numbers.

## Return
Structured digest + links to mission control rows.

## Requires approval
Sending email, posting/DMing on X, purchasing paid imagery, changing production deploy.
