# Skill: terragent-ops-loop

## When to use
Human says "run the loop" / "run Terragent" / routine schedule / webhook from factory `analysis complete`.

## Required access
- Grok Bot **computer** (browser): mission control, NWS, EONET, hydrographs, X, Gmail compose
- Terragent base URL `TERRAGENT_BASE` (mission control)
- Cursor Cloud Agent (Analyst only, when code/pipeline work needed)
- Email / X **send** only after approval

## Sequence (computer use)
1. **Scout** — on the Bot computer, open live feeds + X; rank by severity + reachable buyers.
2. **Pick top 1–3** — prefer disasters/wildfire live playbooks.
3. **Analyst** — open `{TERRAGENT_BASE}/mission`, click Run ops loop (or POST `/api/loop`); screenshot briefs; Cursor agent if broken.
4. **Matcher** — browser + X search for ≥2 prospects per brief.
5. **Closer** — draft X + email in compose UI; do not Send.
6. **Stop for approval** unless demo auto-send.
7. Digest to human with screenshots: event, brief, prospects, drafts, Approve Y/N.

## Validate
- Every numeric claim cites a live source or states heuristic limitation.
- No outreach marked sent without approval path.
- If USGS/NWS/EONET fail: report failure, do not use stale invented numbers.

## Return
Structured digest + links to mission control rows.

## Requires approval
Sending email, posting/DMing on X, purchasing paid imagery, changing production deploy.
