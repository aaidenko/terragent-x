/**
 * NOAA National Water Prediction Service (NWPS) gauge parsing + mapping.
 * Pure functions only (no fetch, no runtime imports) so node:test can load
 * this file directly. Fetching lives in signals.ts.
 *
 * API: https://api.water.noaa.gov/nwps/v1/gauges/{LID}
 *      https://api.water.noaa.gov/nwps/v1/gauges?bbox.xmin=…&srid=EPSG_4326
 */
import type { GeoJsonGeometry } from "./geo";
import type { SignalEvent } from "./types";

export const NWPS_BASE = "https://api.water.noaa.gov/nwps/v1";

export type FloodCategory = "action" | "minor" | "moderate" | "major";
const FLOOD_CATEGORIES: FloodCategory[] = ["action", "minor", "moderate", "major"];

/**
 * Named hero signals keep a stable event id but resolve their gauge by NWS
 * location id (LID). The USGS id is read from NWPS (`usgsId`) at runtime;
 * `expectedUsgsId` is only used to detect a mis-mapping and as the USGS IV
 * fallback when NWPS is down. Verified against live NWPS + USGS on
 * 2026-11-19: COCF1 = "St. Johns River near Cocoa", usgsId 02232400
 * (USGS 02232000 is "St. Johns River near Melbourne" — a different gauge).
 */
export const NAMED_GAUGE_SIGNALS: Record<
  string,
  { lid: string; expectedUsgsId: string; hints: string[] }
> = {
  "flood-cocoa-stjohns": {
    lid: "COCF1",
    expectedUsgsId: "02232400",
    hints: ["Cocoa Florida flooding", "St Johns River flood Brevard", "Brevard EOC shelter"],
  },
};

export function lidForSignal(signalId: string): string | null {
  return NAMED_GAUGE_SIGNALS[signalId]?.lid ?? null;
}

type NwpsStatusPoint = {
  primary?: number;
  primaryUnit?: string;
  floodCategory?: string;
  validTime?: string;
};

export type NwpsGaugeJson = {
  lid?: string;
  usgsId?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  state?: { abbreviation?: string };
  county?: string;
  wfo?: { abbreviation?: string };
  inService?: { enabled?: boolean };
  status?: { observed?: NwpsStatusPoint; forecast?: NwpsStatusPoint };
  flood?: {
    stageUnits?: string;
    categories?: Partial<Record<FloodCategory, { stage?: number }>>;
    crests?: {
      historic?: Array<{ occurredTime?: string; stage?: number; olddatum?: boolean }>;
    };
  };
};

export type GaugeReading = {
  lid: string;
  usgsId: string | null;
  name: string;
  lat: number;
  lon: number;
  state: string | null;
  county: string | null;
  wfo: string | null;
  observed: { stageFt: number; category: string; validTime: string } | null;
  forecast: { stageFt: number; category: string; validTime: string } | null;
  thresholds: Partial<Record<FloodCategory, number>>;
  recordCrest: { stageFt: number; date: string | null; oldDatum: boolean } | null;
};

/** NWPS uses -999 / -9999 sentinels for "no value". */
function realNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= -999) return null;
  return n;
}

function statusPoint(p?: NwpsStatusPoint) {
  const stage = realNumber(p?.primary);
  if (stage == null || !p?.validTime || p.validTime.startsWith("0001-")) return null;
  return { stageFt: stage, category: p.floodCategory ?? "unknown", validTime: p.validTime };
}

export function parseNwpsGauge(json: NwpsGaugeJson | null | undefined): GaugeReading | null {
  if (!json?.lid) return null;
  const lat = realNumber(json.latitude);
  const lon = json.longitude;
  if (lat == null || typeof lon !== "number" || !Number.isFinite(lon)) return null;

  const thresholds: Partial<Record<FloodCategory, number>> = {};
  for (const c of FLOOD_CATEGORIES) {
    const s = realNumber(json.flood?.categories?.[c]?.stage);
    if (s != null) thresholds[c] = s;
  }

  let recordCrest: GaugeReading["recordCrest"] = null;
  for (const crest of json.flood?.crests?.historic ?? []) {
    const s = realNumber(crest.stage);
    if (s == null) continue;
    if (!recordCrest || s > recordCrest.stageFt) {
      recordCrest = {
        stageFt: s,
        date: crest.occurredTime?.slice(0, 10) ?? null,
        oldDatum: Boolean(crest.olddatum),
      };
    }
  }

  return {
    lid: json.lid,
    usgsId: json.usgsId?.trim() || null,
    name: json.name ?? json.lid,
    lat,
    lon,
    state: json.state?.abbreviation ?? null,
    county: json.county ?? null,
    wfo: json.wfo?.abbreviation ?? null,
    observed: statusPoint(json.status?.observed),
    forecast: statusPoint(json.status?.forecast),
    thresholds,
    recordCrest,
  };
}

const CATEGORY_RANK: Record<string, number> = { action: 1, minor: 2, moderate: 3, major: 4 };

export function categoryRank(category: string | undefined | null): number {
  return CATEGORY_RANK[category ?? ""] ?? 0;
}

/** True when observed or forecast stage is at/above minor flood. */
export function isFlooding(g: {
  status?: { observed?: NwpsStatusPoint; forecast?: NwpsStatusPoint };
}): boolean {
  return (
    categoryRank(g.status?.observed?.floodCategory) >= 2 ||
    categoryRank(g.status?.forecast?.floodCategory) >= 2
  );
}

export function severityFromCategory(
  observed: string | undefined,
  forecast?: string | undefined,
): SignalEvent["severity"] {
  const o = categoryRank(observed);
  const f = categoryRank(forecast);
  if (o >= 4) return "critical";
  if (o === 3 || f >= 4) return "high";
  if (o === 2 || f === 3) return "medium";
  return "low";
}

/** Build a signal from live NWPS gauge data. Only real NWPS values are used. */
export function gaugeToSignal(
  g: GaugeReading,
  opts?: { id?: string; hints?: string[]; linkedAlertIds?: string[] },
): SignalEvent | null {
  if (!g.observed) return null; // no current observation → no stage claim
  const stage = g.observed.stageFt;
  const minor = g.thresholds.minor;
  const metrics: Record<string, string | number> = {
    site: g.lid,
    gaugeName: g.name,
    stageFt: stage,
    observedCategory: g.observed.category,
    observedAt: g.observed.validTime,
  };
  if (g.usgsId) metrics.usgsId = g.usgsId;
  if (g.thresholds.action != null) metrics.actionStageFt = g.thresholds.action;
  if (minor != null) metrics.floodStageFt = minor;
  if (g.thresholds.moderate != null) metrics.moderateStageFt = g.thresholds.moderate;
  if (g.thresholds.major != null) metrics.majorStageFt = g.thresholds.major;
  if (g.forecast) {
    metrics.forecastStageFt = g.forecast.stageFt;
    metrics.forecastCategory = g.forecast.category;
    metrics.forecastValidTime = g.forecast.validTime;
  }
  if (g.recordCrest) {
    metrics.recordFt = g.recordCrest.stageFt;
    if (g.recordCrest.date) metrics.recordDate = g.recordCrest.date;
    metrics.aboveRecordFt = Number((stage - g.recordCrest.stageFt).toFixed(2));
  }
  if (opts?.linkedAlertIds?.length) metrics.linkedAlerts = opts.linkedAlertIds.join(",");

  const parts = [
    `Live NWPS ${g.lid} stage ${stage.toFixed(2)} ft (${g.observed.category.replace(/_/g, " ")}) at ${g.observed.validTime}.`,
  ];
  if (minor != null) parts.push(`NWPS flood stage ${minor} ft.`);
  if (g.forecast) {
    parts.push(
      `Forecast ${g.forecast.stageFt.toFixed(2)} ft (${g.forecast.category.replace(/_/g, " ")}) by ${g.forecast.validTime}.`,
    );
  }
  if (g.recordCrest && stage > g.recordCrest.stageFt) {
    parts.push(
      `Above the highest NWPS historic crest of ${g.recordCrest.stageFt} ft${g.recordCrest.date ? ` (${g.recordCrest.date})` : ""}.`,
    );
  }

  return {
    id: opts?.id ?? `nwps-${g.lid}`,
    market: "disasters",
    title: `${g.name} (${g.lid}) — ${stage.toFixed(2)} ft`,
    summary: parts.join(" "),
    lat: g.lat,
    lon: g.lon,
    severity: severityFromCategory(g.observed.category, g.forecast?.category),
    source: `NOAA NWPS ${g.lid}${g.usgsId ? ` / USGS ${g.usgsId}` : ""}`,
    sourceUrl: `https://water.noaa.gov/gauges/${g.lid.toLowerCase()}`,
    observedAt: g.observed.validTime,
    metrics,
    xHints: opts?.hints ?? [`${g.name} flooding`, `${g.county ?? g.state ?? ""} flood`.trim()],
  };
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bst\.?\s/g, "st ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\bnear above\b/g, "above")
    .replace(/\b\d+(n|s|e|w|ne|nw|se|sw)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * River names an NWS Flood Warning says it "continues for" / "is issued for".
 * NWS format: "...The Flood Warning continues for the following rivers in
 * Florida...\n\n  St Johns River Near Deland affecting Lake and Volusia Counties."
 */
export function warnedRiverPoints(description: string): string[] {
  const m = description.match(/following rivers in [A-Za-z ]+\.\.\.([\s\S]*?)(?:\n\s*\n\s*\.|\n\s*\.[A-Z]|$)/);
  if (!m) return [];
  return m[1]
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\s+affecting\b.*$/i, "").trim())
    .filter((line) => /river|creek|lake|canal|bayou|run|branch/i.test(line));
}

/**
 * Map a river Flood Warning to NWPS gauges. A gauge is linked when its
 * name matches a warned forecast point, or (if the text names no point) when
 * the gauge lies inside the warning polygon. Returns LIDs.
 */
export function linkGaugesToWarning(
  alert: { description: string; geometry?: GeoJsonGeometry | null },
  gauges: Array<{ lid: string; name: string; lat: number; lon: number }>,
  pointIn: (lat: number, lon: number, g: GeoJsonGeometry | null | undefined) => boolean,
): string[] {
  const points = warnedRiverPoints(alert.description).map(normalizeName);
  if (points.length) {
    const byName = gauges.filter((g) => {
      const n = normalizeName(g.name);
      return points.some((p) => p === n || p.startsWith(`${n} `) || n.startsWith(`${p} `));
    });
    if (byName.length) return byName.map((g) => g.lid);
  }
  if (!alert.geometry) return [];
  return gauges.filter((g) => pointIn(g.lat, g.lon, alert.geometry)).map((g) => g.lid);
}
