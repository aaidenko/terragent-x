import type { EoAnalysis } from "./eo";
import { applyEoQuality } from "./eo-brief";
import { FINDING_ALERT_TEXT_MAX, buildFloodBrief } from "./flood-brief";
import { playbookById } from "./playbooks";
import { clipText } from "./text";
import type { AnalysisBrief, SignalEvent } from "./types";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clusterFires(events: SignalEvent[]) {
  const fires = events.filter((e) => e.market === "wildfire");
  if (fires.length === 0) return null;
  const lats = fires.map((f) => f.lat);
  const lons = fires.map((f) => f.lon);
  const acres = fires.map((f) => Number(f.metrics?.magnitude ?? 0));
  return {
    count: fires.length,
    meanLat: lats.reduce((a, b) => a + b, 0) / lats.length,
    meanLon: lons.reduce((a, b) => a + b, 0) / lons.length,
    totalAcres: acres.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    titles: fires.slice(0, 5).map((f) => f.title),
  };
}

export function analyzeEvent(
  event: SignalEvent,
  eo?: EoAnalysis | null,
  fireCluster?: ReturnType<typeof clusterFires>,
): AnalysisBrief {
  const playbook = playbookById(event.market);
  const now = new Date().toISOString();

  if (event.market === "disasters") {
    const parts = buildFloodBrief(event, eo);
    return {
      id: uid("brief"),
      eventId: event.id,
      market: event.market,
      ...parts,
      createdAt: now,
      mapHint: { lat: event.lat, lon: event.lon, label: event.title },
    };
  }

  if (event.market === "wildfire") {
    const acres = Number(event.metrics?.magnitude ?? 0);
    const clusterNote = fireCluster
      ? ` Cluster of ${fireCluster.count} open EONET wildfire signals; ~${Math.round(fireCluster.totalAcres).toLocaleString()} acres reported across linked incidents.`
      : "";
    return {
      id: uid("brief"),
      eventId: event.id,
      market: event.market,
      headline: `Wildfire exposure · ${event.title}`,
      finding: `EONET/IRWIN-linked incident${acres ? ` (~${acres.toLocaleString()} acres reported)` : ""}.${clusterNote} 10 km buffer around detection used to rank timber, ranch, and infrastructure assets. Recommend Sentinel-2 NBR burn-scar follow-up on next clear pass.`,
      confidence: 0.74,
      method: [
        "NASA EONET wildfire geometry",
        "Hotspot / incident clustering across open events",
        "10 km asset exposure buffer",
        "Buyer ranking for land / timber / utility corridors",
      ],
      metrics: {
        acres: acres || "unknown",
        bufferKm: 10,
        clusterCount: fireCluster?.count ?? 1,
        clusterAcres: fireCluster?.totalAcres ?? acres,
        followUp: "Sentinel-2 NBR on next clear scene",
      },
      limitations: [
        "Thermal/IRWIN report ≠ final burn perimeter",
        "FIRMS MAP_KEY optional — set FIRMS_MAP_KEY for VIIRS hotspot CSV enrichment",
      ],
      createdAt: now,
      mapHint: { lat: event.lat, lon: event.lon, label: event.title },
    };
  }

  return {
    id: uid("brief"),
    eventId: event.id,
    market: event.market,
    headline: `${playbook?.name ?? event.market} signal · ${event.title}`,
    finding: clipText(event.summary || event.title, FINDING_ALERT_TEXT_MAX),
    confidence: 0.55,
    method: [playbook?.analysis ?? "playbook stub", "signal normalization"],
    metrics: { status: playbook?.status ?? "ready" },
    limitations: ["Deep imagery recipe not executed on this event yet"],
    createdAt: now,
    mapHint: { lat: event.lat, lon: event.lon, label: event.title },
  };
}

export function analyzeTopEvents(
  events: SignalEvent[],
  limit = 3,
  eoByEventId: Record<string, EoAnalysis | null> = {},
): AnalysisBrief[] {
  const fireCluster = clusterFires(events);
  const ranked = [...events].sort((a, b) => {
    const rank = { critical: 4, high: 3, medium: 2, low: 1 };
    // Prefer events with live gauge metrics for disasters
    const boost = (e: SignalEvent) =>
      e.market === "disasters" && typeof e.metrics?.stageFt === "number" ? 0.5 : 0;
    return rank[b.severity] + boost(b) - (rank[a.severity] + boost(a));
  });
  // One brief per river gauge: a gauge signal and the warning linked to it
  // carry the same stage, so don't spend two of the top slots on it.
  const seenGauges = new Set<string>();
  const picked: SignalEvent[] = [];
  for (const event of ranked) {
    if (picked.length >= limit) break;
    const lid = typeof event.metrics?.site === "string" ? event.metrics.site : null;
    if (lid && event.market === "disasters") {
      if (seenGauges.has(lid)) continue;
      seenGauges.add(lid);
    }
    picked.push(event);
  }
  return picked.map((event) =>
    applyEoQuality(
      analyzeEvent(event, eoByEventId[event.id], fireCluster),
      eoByEventId[event.id],
    ),
  );
}

export { clusterFires };
