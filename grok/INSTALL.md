# Install Terragent Grok agents on YOUR machine (2 minutes)

I cannot create Grok Bots from the Cursor cloud VM. You install them in the **Grok Bot app** (desktop/phone). They run on **Grok’s cloud computer** (browser, apps) — that is the computer-use layer. Coding hard jobs go to **Cursor Cloud Agents**.

## Do this now

1. Open **Grok Bot** on your computer.
2. **New Bot** → name it `Terragent Setup`.
3. Open `grok/PASTE-THIS-TO-GROK.md` in this repo and **paste the entire file** as the first message.
4. Let Setup create the 5 bots + tell you plugins to connect.
5. Connect: **Cursor**, **X**, **Gmail** (as available).
6. Open **Terragent CEO** and send:

```
Remember TERRAGENT_BASE as whatever URL I give next. Save skill terragent-ops-loop from the install message. Then run one full loop with computer use. Draft only — do not send. Screenshot mission control.
```

7. Paste your live app URL (from Cursor Publish / local `http://127.0.0.1:3847`).

8. After one good run, ask CEO to create the **every 2 hours** routine (draft-only). Use **Test** for the hackathon video.

## What “computer use” means here

| Action | Where it runs |
|--------|----------------|
| Open mission control, click Run ops loop | Grok Bot cloud computer browser |
| Search X / open hydrographs / NWS | Grok Bot cloud computer |
| Draft email / X | Grok Bot + plugins (send = approval) |
| Fix EO pipeline code | Cursor Cloud Agent on `terragent-x` |

Your laptop is the place you **chat and approve**. The Bot computer does the clicking.

## Optional: private worker on your Mac

If you need the agent on a machine you own (VPN, local-only URL), set that Mac up as a **Cursor Cloud private worker** and tell Analyst/CEO to run Cloud Agents there. Otherwise the shared Grok Bot computer is enough for the demo.

## Demo line for judges

“Five Grok Bots run the company on a computer: Scout reads live NASA/NOAA, Analyst drives our factory UI, Matcher finds buyers on X, Closer drafts outreach, CEO only delegates — we approve the send.”
