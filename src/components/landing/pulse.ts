import { getMissionState } from "@/lib/loop";
import { collectLiveSignals } from "@/lib/signals";
import type { SignalEvent } from "@/lib/types";

/*
 * Live numbers for the landing page. Read-only use of the existing pipeline:
 * prefer the latest ops-loop pass in memory; otherwise read the public feeds
 * directly, memoized for five minutes and bounded by a timeout so the page
 * never hangs on a slow upstream.
 */
export type Pulse = {
  events: SignalEvent[];
  briefs: number;
  prospects: number;
  sent: number;
  source: "loop" | "feeds" | "unavailable";
  readAt: string;
};

const TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 4500;

const memo = globalThis as unknown as {
  __txPulse?: { at: number; events: SignalEvent[] };
  __txPulseInflight?: Promise<SignalEvent[] | null> | null;
};

function startRead(): Promise<SignalEvent[] | null> {
  if (!memo.__txPulseInflight) {
    memo.__txPulseInflight = collectLiveSignals()
      .then((events) => {
        memo.__txPulse = { at: Date.now(), events };
        return events;
      })
      .catch(() => null)
      .finally(() => {
        memo.__txPulseInflight = null;
      });
  }
  return memo.__txPulseInflight;
}

async function readFeeds(): Promise<SignalEvent[] | null> {
  const hit = memo.__txPulse;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.events;
  // A slow upstream keeps reading in the background and fills the cache
  // for the next visitor; this request falls back to the last good read.
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT_MS));
  const events = await Promise.race([startRead(), timeout]);
  return events ?? hit?.events ?? null;
}

export async function getPulse(): Promise<Pulse> {
  const state = getMissionState();
  const lastLoop = state.loops.find((l) => l.status !== "running");
  const sent = state.outreach.filter((o) => o.status === "sent").length;

  if (lastLoop && lastLoop.eventIds.length) {
    const ids = new Set(lastLoop.eventIds);
    return {
      events: state.events.filter((e) => ids.has(e.id)),
      briefs: state.briefs.length,
      prospects: state.prospects.length,
      sent,
      source: "loop",
      readAt: lastLoop.finishedAt ?? lastLoop.startedAt,
    };
  }

  const events = await readFeeds();
  return {
    events: events ?? [],
    briefs: state.briefs.length,
    prospects: state.prospects.length,
    sent,
    source: events ? "feeds" : "unavailable",
    readAt: new Date(memo.__txPulse?.at ?? Date.now()).toISOString(),
  };
}
