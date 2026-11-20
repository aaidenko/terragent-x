import type { MarketId } from "@/lib/playbooks";
import type { LoopRun, OutreachDraft, SignalEvent } from "@/lib/types";

/*
 * UI-only formatting. Raw enums never reach the screen.
 */

export const MARKET_LABEL: Record<MarketId, string> = {
  disasters: "Disasters",
  wildfire: "Wildfire",
  deforestation: "Deforestation",
  mining: "Mining",
  private_brokerage: "Private brokerage",
};

export const LOOP_STATUS_LABEL: Record<LoopRun["status"], string> = {
  running: "Running",
  awaiting_approval: "Awaiting approval",
  complete: "Complete",
  error: "Error",
};

export const DRAFT_STATUS_LABEL: Record<OutreachDraft["status"], string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  failed: "Failed",
};

export const SEVERITY_LABEL: Record<SignalEvent["severity"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const SEVERITY_LEVEL: Record<SignalEvent["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const STEP_LABEL: Record<string, string> = {
  scout: "Scout",
  analyst: "Analyst",
  matcher: "Matcher",
  closer: "Closer",
  human: "Human",
  error: "Error",
};

export function relativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const s = Math.round((now - t) / 1000);
  if (s < 0) {
    const ahead = Math.abs(s);
    if (ahead < 3600) return `in ${Math.max(1, Math.round(ahead / 60))} min`;
    return `in ${Math.round(ahead / 3600)} h`;
  }
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function clock(iso: string | undefined): string {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export function utcStamp(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function coords(lat: number, lon: number, digits = 2): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "—";
  return `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? "N" : "S"}  ${Math.abs(lon).toFixed(digits)}°${lon >= 0 ? "E" : "W"}`;
}

export function percent(x: number): string {
  if (!Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

/** camelCase metric keys → readable labels, with units pulled from suffixes. */
export function metricEntry(key: string, value: string | number): { label: string; value: string } {
  let unit = "";
  let k = key;
  if (/Ft$/.test(k)) {
    unit = " ft";
    k = k.replace(/Ft$/, "");
  }
  const label = k
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
  let v = typeof value === "number" ? String(value) : value;
  if (typeof value === "string") v = value.replace(/_/g, " ");
  if (v === "" || v === "n/a") v = "—";
  return { label, value: v === "—" ? v : `${v}${unit}` };
}

/* ───────────── Provenance, derived from what the feeds already return ───────────── */

export type FeedId = "usgs" | "eonet" | "nws";

export const FEEDS: { id: FeedId; name: string; detail: string; endpoint: string }[] = [
  {
    id: "usgs",
    name: "USGS NWIS",
    detail: "St. Johns River near Cocoa, gauge 02232000",
    endpoint: "waterservices.usgs.gov",
  },
  {
    id: "eonet",
    name: "NASA EONET",
    detail: "Open wildfire, storm and flood events",
    endpoint: "eonet.gsfc.nasa.gov",
  },
  {
    id: "nws",
    name: "NWS alerts",
    detail: "Active Florida flood alerts",
    endpoint: "api.weather.gov",
  },
];

export function feedOf(e: SignalEvent): FeedId {
  const s = e.source.toLowerCase();
  if (s.startsWith("eonet")) return "eonet";
  if (s.startsWith("nws alerts")) return "nws";
  return "usgs";
}

/** The gauge falls back to a cached briefing when the live read flaps. */
export function isFallback(e: SignalEvent): boolean {
  return /cached/i.test(e.source);
}

/** NWS alerts arrive without point geometry and are pinned to a region default. */
export function isApproximateLocation(e: SignalEvent): boolean {
  return feedOf(e) === "nws";
}

export type FeedReading = {
  id: FeedId;
  name: string;
  detail: string;
  endpoint: string;
  count: number;
  state: "live" | "fallback" | "quiet" | "idle";
  latestAt?: string;
};

/**
 * Per-feed readout for one loop pass. "quiet" means the feed returned no
 * matching events this pass — either nothing is happening or it was
 * unreachable; the pipeline treats both the same and never invents data.
 */
export function readFeeds(events: SignalEvent[], ran: boolean): FeedReading[] {
  return FEEDS.map((f) => {
    const mine = events.filter((e) => feedOf(e) === f.id);
    const latestAt = mine
      .map((e) => e.observedAt)
      .filter(Boolean)
      .sort()
      .at(-1);
    let state: FeedReading["state"] = ran ? "quiet" : "idle";
    if (mine.length) state = mine.some(isFallback) ? "fallback" : "live";
    return { ...f, count: mine.length, state, latestAt };
  });
}

export const FEED_STATE_LABEL: Record<FeedReading["state"], string> = {
  live: "Live",
  fallback: "Fallback snapshot",
  quiet: "No events this pass",
  idle: "Not read yet",
};
