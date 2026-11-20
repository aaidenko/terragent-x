/**
 * NWS alert → SignalEvent normalization. Pure (no fetch, type-only imports)
 * so node:test can load it. Each alert carries ONLY its own data: its own
 * polygon/zone centroid, its own VTEC/parameters. No river-stage defaults.
 */
import type { GeoJsonGeometry } from "./geo";
import type { SignalEvent } from "./types";

export type NwsAlertFeature = {
  id: string;
  properties?: {
    event?: string;
    headline?: string;
    areaDesc?: string;
    severity?: string;
    certainty?: string;
    urgency?: string;
    effective?: string;
    onset?: string;
    expires?: string;
    ends?: string | null;
    messageType?: string;
    description?: string;
    instruction?: string | null;
    senderName?: string;
    affectedZones?: string[];
    parameters?: Record<string, string[] | undefined>;
  };
  geometry?: GeoJsonGeometry | null;
};

export type Vtec = {
  action: string;
  office: string;
  phenomenon: string;
  significance: string;
  etn: string;
};

/** P-VTEC: /k.aaa.cccc.pp.s.####.yymmddThhnnZ-yymmddThhnnZ/ */
export function parseVtec(raw: string | undefined): Vtec | null {
  const m = raw?.match(/\/[OTEX]\.([A-Z]{3})\.([A-Z]{4})\.([A-Z]{2})\.([A-Z])\.(\d{4})\./);
  if (!m) return null;
  return { action: m[1], office: m[2], phenomenon: m[3], significance: m[4], etn: m[5] };
}

/** FL = river (forecast-point) flood; FA = areal/rainfall flood; FF = flash flood. */
export function floodKind(
  event: string,
  vtec: Vtec | null,
): "river" | "areal" | "flash" | "coastal" | "other" {
  const p = vtec?.phenomenon;
  if (p === "FL") return "river";
  if (p === "FF" || /flash flood/i.test(event)) return "flash";
  if (p === "CF" || p === "LS" || /coastal|lakeshore/i.test(event)) return "coastal";
  if (p === "FA" || /flood/i.test(event)) return "areal";
  return "other";
}

export function isFloodAlert(f: NwsAlertFeature): boolean {
  return /flood/i.test(f.properties?.event ?? "");
}

function severityOf(nwsSeverity: string | undefined): SignalEvent["severity"] {
  const s = (nwsSeverity ?? "").toLowerCase();
  if (s === "extreme" || s === "severe") return "critical";
  if (s === "moderate") return "high";
  if (s === "minor") return "medium";
  return "medium";
}

/**
 * Normalize one alert. `location` must come from the alert's own polygon or
 * its affected-zone geometries; callers drop alerts with no location rather
 * than pinning them to a default point.
 */
export function alertToSignal(
  f: NwsAlertFeature,
  location: { lat: number; lon: number; source: "polygon" | "zones" },
  extra?: { metrics?: Record<string, string | number> },
): SignalEvent {
  const p = f.properties ?? {};
  const params = p.parameters ?? {};
  const vtec = parseVtec(params.VTEC?.[0]);
  const kind = floodKind(p.event ?? "", vtec);
  const headline = params.NWSheadline?.[0];

  const metrics: Record<string, string | number> = {
    event: p.event ?? "",
    area: p.areaDesc ?? "",
    floodKind: kind,
    locationSource: location.source === "polygon" ? "alert_polygon_centroid" : "affected_zones_centroid",
  };
  if (p.severity) metrics.nwsSeverity = p.severity;
  if (p.certainty) metrics.nwsCertainty = p.certainty;
  if (p.urgency) metrics.nwsUrgency = p.urgency;
  if (p.messageType) metrics.messageType = p.messageType;
  if (p.onset) metrics.onset = p.onset;
  if (p.ends) metrics.ends = p.ends;
  else if (p.expires) metrics.expires = p.expires;
  if (vtec) {
    metrics.vtec = `${vtec.office}.${vtec.phenomenon}.${vtec.significance}.${vtec.etn} ${vtec.action}`;
  }
  if (headline) metrics.nwsHeadline = headline;
  Object.assign(metrics, extra?.metrics ?? {});

  const id = f.id?.split("/").pop() || f.id;
  return {
    id: `nws-${id}`,
    market: "disasters",
    title: p.headline || p.event || "NWS flood alert",
    summary: (p.description ?? p.areaDesc ?? "").trim(),
    lat: Number(location.lat.toFixed(4)),
    lon: Number(location.lon.toFixed(4)),
    severity: severityOf(p.severity),
    source: `NWS alerts${p.senderName ? ` · ${p.senderName}` : ""}`,
    sourceUrl: f.id,
    observedAt: p.effective ?? p.onset ?? new Date().toISOString(),
    metrics,
    xHints: [`${p.event ?? "Flood alert"} Florida`, p.areaDesc?.split(";")[0]?.trim() ?? "FL flood"],
  };
}
