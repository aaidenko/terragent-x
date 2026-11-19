import type { EoAnalysis } from "./eo";
import { playbookById } from "./playbooks";
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
    const stage = Number(event.metrics?.stageFt ?? 0);
    const flood = Number(event.metrics?.floodStageFt ?? 16);
    const record = Number(event.metrics?.recordFt ?? 17.6);
    const overFlood = stage ? stage - flood : null;
    const overRecord = stage ? stage - record : null;

    const methods = [
      "USGS/NWS stage vs published flood & record thresholds",
      "Asset class scoring for riverside residential + marina footprints",
      ...(eo?.method ?? []),
      playbook?.analysis ?? "disaster playbook",
    ];

    const limitations = [
      ...(eo?.limitations ?? []),
      "Parcel ownership not verified against county assessor in this pass",
      "Gauge is a point; wind/backwater can change local depths",
    ];

    let finding: string;
    const metrics: Record<string, string | number> = {
      stageFt: stage || "alert-only",
      floodStageFt: flood,
      recordFt: record,
      aoiKm: 5,
      dataMode: stage > 0 ? "live_gauge" : "alert_fusion",
    };

    if (eo?.ok && eo.recent) {
      metrics.ndwi_water_fraction = Number(eo.recent.water_fraction.toFixed(4));
      metrics.ndwi_mean = Number(eo.recent.ndwi_mean.toFixed(4));
      metrics.sentinel_scene = eo.recent.scene_id;
      metrics.sentinel_cloud_pct = Number(eo.recent.cloud_cover_pct.toFixed(2));
      metrics.sentinel_datetime = eo.recent.datetime;
      metrics.eo_model = eo.recent.model ?? "ndwi";
      if (eo.recent.mlp?.train_acc != null) {
        metrics.mlp_train_acc = eo.recent.mlp.train_acc;
      }
      if (eo.recent.mndwi_mean != null) {
        metrics.mndwi_mean = Number(eo.recent.mndwi_mean.toFixed(4));
      }
      if (eo.delta) {
        metrics.water_fraction_delta = Number(
          eo.delta.water_fraction_delta.toFixed(4),
        );
      }
      const modelLabel =
        eo.recent.model === "weakly_supervised_mlp"
          ? `weakly-supervised MLP water classifier (train acc ${((eo.recent.mlp?.train_acc ?? 0) * 100).toFixed(1)}%)`
          : "NDWI+MNDWI fusion";
      finding =
        (stage > 0
          ? `Live gauge ${stage.toFixed(2)} ft is ${(overFlood ?? 0).toFixed(2)} ft above flood stage` +
            (overRecord !== null && overRecord > 0
              ? ` and ${overRecord.toFixed(2)} ft above the all-time record (${record} ft). `
              : ". ")
          : `${event.summary.slice(0, 180)} `) +
        `Sentinel-2 scene ${eo.recent.scene_id} (${eo.recent.datetime.slice(0, 10)}, cloud ${eo.recent.cloud_cover_pct.toFixed(1)}%) with SCL masking + ${modelLabel} estimates clear-pixel water fraction ${(eo.recent.water_fraction * 100).toFixed(2)}%` +
        (eo.delta
          ? ` (Δ ${(eo.delta.water_fraction_delta * 100).toFixed(2)} pp vs prior-month baseline).`
          : ".") +
        ` Optical mask is fused with the live hydro signal for outreach-ready impact.`;
    } else {
      const wetFraction =
        stage >= record ? 0.42 : stage >= flood + 1 ? 0.28 : stage >= flood ? 0.15 : 0.05;
      metrics.estimatedWetFraction = wetFraction;
      metrics.dataMode = `${metrics.dataMode}+heuristic_fallback`;
      limitations.unshift(
        eo?.error
          ? `Imagery unavailable (${eo.error}) — heuristic wet-fraction used`
          : "Imagery skipped — heuristic wet-fraction used",
      );
      finding =
        stage > 0
          ? `Live gauge ${stage.toFixed(2)} ft is ${(overFlood ?? 0).toFixed(2)} ft above flood stage` +
            (overRecord !== null && overRecord > 0
              ? ` and ${overRecord.toFixed(2)} ft above the all-time record (${record} ft).`
              : ".") +
            ` Heuristic inundation model estimates ~${Math.round(wetFraction * 100)}% of the 5 km riverside AOI at immediate risk.`
          : `${event.summary} Public alert fused with AOI buffer analysis for outreach-ready property impact.`;
    }

    return {
      id: uid("brief"),
      eventId: event.id,
      market: event.market,
      headline:
        stage >= record
          ? `Record flood + EO fusion · ${event.title.split("—")[0].trim()}`
          : `Flood EO brief · ${event.title.slice(0, 80)}`,
      finding,
      confidence: eo?.ok ? 0.86 : stage > 0 ? 0.72 : 0.6,
      method: methods,
      metrics,
      limitations,
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
    finding: `${event.summary} Playbook "${playbook?.name}" is wired for agent handoff; deep raster recipe runs when a clear scene is queued.`,
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
      e.market === "disasters" && e.metrics?.stageFt != null ? 0.5 : 0;
    return rank[b.severity] + boost(b) - (rank[a.severity] + boost(a));
  });
  return ranked.slice(0, limit).map((event) =>
    analyzeEvent(event, eoByEventId[event.id], fireCluster),
  );
}

export { clusterFires };
