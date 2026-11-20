import { alertToSignal, floodKind, isFloodAlert, parseVtec, type NwsAlertFeature } from "./alerts";
import { geometryCentroid, meanPoint, pointInGeometry, type GeoJsonGeometry } from "./geo";
import {
  NAMED_GAUGE_SIGNALS,
  NWPS_BASE,
  categoryRank,
  gaugeToSignal,
  isFlooding,
  linkGaugesToWarning,
  parseNwpsGauge,
  type GaugeReading,
  type NwpsGaugeJson,
} from "./nwps";
import type { SignalEvent } from "./types";

const FETCH_TIMEOUT_MS = 20_000;
/** Max NWPS gauges fetched in detail per loop (flooding + warning-linked). */
const MAX_GAUGES = 16;
/** Max zone geometries fetched for an alert without its own polygon. */
const MAX_ZONES_PER_ALERT = 8;
/** Florida bounding box for the NWPS gauge listing. */
const FL_BBOX = { xmin: -87.7, ymin: 24.4, xmax: -79.8, ymax: 31.1 };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/geo+json, application/json",
        "User-Agent": "Terragent/0.1 (hackathon; earth-intel demo)",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type UsgsIv = {
  value?: {
    timeSeries?: Array<{
      sourceInfo?: {
        siteName?: string;
        geoLocation?: { geogLocation?: { latitude?: number; longitude?: number } };
      };
      values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }>;
    }>;
  };
};

type NwpsListGauge = {
  lid: string;
  name: string;
  state?: { abbreviation?: string };
  latitude: number;
  longitude: number;
  status?: NwpsGaugeJson["status"];
};

export async function fetchNwpsGauge(lid: string): Promise<GaugeReading | null> {
  const json = await fetchJson<NwpsGaugeJson>(`${NWPS_BASE}/gauges/${encodeURIComponent(lid)}`);
  return parseNwpsGauge(json);
}

/** All NWPS gauges in Florida (lightweight listing incl. status). */
export async function fetchNwpsFloridaGauges(): Promise<NwpsListGauge[]> {
  const q = new URLSearchParams({
    "bbox.xmin": String(FL_BBOX.xmin),
    "bbox.ymin": String(FL_BBOX.ymin),
    "bbox.xmax": String(FL_BBOX.xmax),
    "bbox.ymax": String(FL_BBOX.ymax),
    srid: "EPSG_4326",
  });
  const data = await fetchJson<{ gauges?: NwpsListGauge[] }>(`${NWPS_BASE}/gauges?${q}`);
  return (data?.gauges ?? []).filter(
    (g) =>
      g.state?.abbreviation === "FL" &&
      typeof g.latitude === "number" &&
      typeof g.longitude === "number",
  );
}

/**
 * USGS IV stage-only fallback for a named gauge when NWPS is unreachable.
 * Uses the verified USGS id for that gauge and reports stage only: flood
 * thresholds come from NWPS, so none are claimed here.
 */
async function usgsStageFallback(signalId: string): Promise<SignalEvent | null> {
  const named = NAMED_GAUGE_SIGNALS[signalId];
  if (!named) return null;
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${named.expectedUsgsId}&parameterCd=00065&siteStatus=all`;
  const data = await fetchJson<UsgsIv>(url);
  const series = data?.value?.timeSeries?.[0];
  const latest = series?.values?.[0]?.value?.at(-1);
  const lat = series?.sourceInfo?.geoLocation?.geogLocation?.latitude;
  const lon = series?.sourceInfo?.geoLocation?.geogLocation?.longitude;
  const stageFt = Number(latest?.value);
  if (!latest?.value || !Number.isFinite(stageFt) || lat == null || lon == null) return null;
  const name = series?.sourceInfo?.siteName ?? `USGS ${named.expectedUsgsId}`;
  return {
    id: signalId,
    market: "disasters",
    title: `${name} (USGS ${named.expectedUsgsId}) — ${stageFt.toFixed(2)} ft`,
    summary: `Live USGS stage ${stageFt.toFixed(2)} ft at ${latest.dateTime ?? "latest reading"}. NWPS (${named.lid}) unavailable, so no flood-category comparison was made.`,
    lat,
    lon,
    severity: "low",
    source: `USGS NWIS IV ${named.expectedUsgsId}`,
    sourceUrl: url,
    observedAt: latest.dateTime ?? new Date().toISOString(),
    metrics: {
      site: named.lid,
      usgsId: named.expectedUsgsId,
      gaugeName: name,
      stageFt: Number(stageFt.toFixed(2)),
    },
    xHints: named.hints,
  };
}

const zoneCache = new Map<string, { lat: number; lon: number } | null>();

async function zoneCentroid(url: string): Promise<{ lat: number; lon: number } | null> {
  if (zoneCache.has(url)) return zoneCache.get(url) ?? null;
  const z = await fetchJson<{ geometry?: GeoJsonGeometry | null }>(url);
  const c = geometryCentroid(z?.geometry ?? null);
  if (z) zoneCache.set(url, c);
  return c;
}

/** Location from the alert's own polygon, else from its affected zones. */
async function alertLocation(
  f: NwsAlertFeature,
): Promise<{ lat: number; lon: number; source: "polygon" | "zones" } | null> {
  const own = geometryCentroid(f.geometry ?? null);
  if (own) return { ...own, source: "polygon" };
  const zones = (f.properties?.affectedZones ?? []).slice(0, MAX_ZONES_PER_ALERT);
  const pts = (await Promise.all(zones.map(zoneCentroid))).filter(
    (p): p is { lat: number; lon: number } => p != null,
  );
  const mean = meanPoint(pts);
  return mean ? { ...mean, source: "zones" } : null;
}

/** Gauge metrics copied onto a river warning that names/contains that gauge. */
const GAUGE_KEYS_FOR_ALERT = [
  "site",
  "gaugeName",
  "usgsId",
  "stageFt",
  "observedCategory",
  "observedAt",
  "actionStageFt",
  "floodStageFt",
  "moderateStageFt",
  "majorStageFt",
  "forecastStageFt",
  "forecastCategory",
  "forecastValidTime",
  "recordFt",
  "recordDate",
  "aboveRecordFt",
];

export async function fetchFloridaFloodSignals(): Promise<SignalEvent[]> {
  const [alertsJson, listing] = await Promise.all([
    // No message_type filter: river Flood Warnings are almost always
    // "Update" (CON/EXT) messages and were being dropped.
    fetchJson<{ features?: NwsAlertFeature[] }>(
      "https://api.weather.gov/alerts/active?area=FL&status=actual",
    ),
    fetchNwpsFloridaGauges(),
  ]);
  const alerts = (alertsJson?.features ?? []).filter(isFloodAlert);

  // 1) Link each river (VTEC FL) warning to the NWPS gauges it names.
  const linked = new Map<string, string[]>(); // alert id -> LIDs
  for (const f of alerts) {
    const vtec = parseVtec(f.properties?.parameters?.VTEC?.[0]);
    if (floodKind(f.properties?.event ?? "", vtec) !== "river") continue;
    const lids = linkGaugesToWarning(
      { description: f.properties?.description ?? "", geometry: f.geometry ?? null },
      listing.map((g) => ({ lid: g.lid, name: g.name, lat: g.latitude, lon: g.longitude })),
      pointInGeometry,
    );
    if (lids.length) linked.set(f.id, lids);
  }

  // 2) Which gauges to read in detail: named hero gauges, warning-linked
  //    gauges, then any other FL gauge at/above minor (observed or forecast).
  const heroLids = Object.values(NAMED_GAUGE_SIGNALS).map((n) => n.lid);
  const warned = [...new Set([...linked.values()].flat())];
  const flooding = listing
    .filter(isFlooding)
    .sort(
      (a, b) =>
        categoryRank(b.status?.observed?.floodCategory) -
          categoryRank(a.status?.observed?.floodCategory) ||
        categoryRank(b.status?.forecast?.floodCategory) -
          categoryRank(a.status?.forecast?.floodCategory),
    )
    .map((g) => g.lid);
  const lids = [...new Set([...heroLids, ...warned, ...flooding])].slice(0, MAX_GAUGES);
  const readings = (await Promise.all(lids.map(fetchNwpsGauge))).filter(
    (g): g is GaugeReading => g != null,
  );
  const byLid = new Map(readings.map((g) => [g.lid, g]));

  const alertIdsByLid = new Map<string, string[]>();
  for (const [alertId, ls] of linked) {
    for (const lid of ls) {
      const short = `nws-${alertId.split("/").pop()}`;
      alertIdsByLid.set(lid, [...(alertIdsByLid.get(lid) ?? []), short]);
    }
  }

  const out: SignalEvent[] = [];

  // 3) Gauge signals (hero ids keep their stable id).
  for (const [signalId, named] of Object.entries(NAMED_GAUGE_SIGNALS)) {
    const g = byLid.get(named.lid);
    if (g && g.usgsId && g.usgsId !== named.expectedUsgsId) {
      console.warn(
        `[terragent] NWPS ${named.lid} reports USGS ${g.usgsId}, expected ${named.expectedUsgsId}; using NWPS value`,
      );
    }
    const sig = g
      ? gaugeToSignal(g, {
          id: signalId,
          hints: named.hints,
          linkedAlertIds: alertIdsByLid.get(g.lid),
        })
      : null;
    const fallback = sig ?? (await usgsStageFallback(signalId));
    if (fallback) out.push(fallback);
  }
  for (const g of readings) {
    if (heroLids.includes(g.lid)) continue;
    const sig = gaugeToSignal(g, { linkedAlertIds: alertIdsByLid.get(g.lid) });
    if (sig) out.push(sig);
  }

  // 4) Alert signals with their own centroid and parameters.
  const located = await Promise.all(alerts.map(async (f) => ({ f, loc: await alertLocation(f) })));
  for (const { f, loc } of located) {
    if (!loc) continue; // never pin an alert to a default point
    const ls = linked.get(f.id) ?? [];
    const extra: Record<string, string | number> = {};
    if (ls.length) {
      extra.linkedGauges = ls.join(",");
      const primary = ls.map((l) => byLid.get(l)).find((g) => g?.observed);
      const gaugeSig = primary ? gaugeToSignal(primary) : null;
      for (const k of GAUGE_KEYS_FOR_ALERT) {
        const v = gaugeSig?.metrics?.[k];
        if (v !== undefined) extra[k] = v;
      }
    }
    out.push(alertToSignal(f, loc, { metrics: extra }));
  }
  return out;
}

/** @deprecated kept for callers; resolves the Cocoa hero via NWPS COCF1. */
export async function fetchCocoaGauge(): Promise<SignalEvent | null> {
  const g = await fetchNwpsGauge(NAMED_GAUGE_SIGNALS["flood-cocoa-stjohns"].lid);
  const named = NAMED_GAUGE_SIGNALS["flood-cocoa-stjohns"];
  return (
    (g ? gaugeToSignal(g, { id: "flood-cocoa-stjohns", hints: named.hints }) : null) ??
    (await usgsStageFallback("flood-cocoa-stjohns"))
  );
}

type EonetResponse = {
  events?: Array<{
    id: string;
    title: string;
    description?: string | null;
    categories?: Array<{ id: string; title: string }>;
    sources?: Array<{ id: string; url: string }>;
    geometry?: Array<{
      date: string;
      coordinates: number[];
      magnitudeValue?: number;
      magnitudeUnit?: string;
    }>;
  }>;
};

export async function fetchEonetEvents(): Promise<SignalEvent[]> {
  const data = await fetchJson<EonetResponse>(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20",
  );
  if (!data?.events?.length) return [];

  const out: SignalEvent[] = [];
  for (const ev of data.events) {
    const cat = ev.categories?.[0]?.id ?? "";
    const geom = ev.geometry?.at(-1);
    if (!geom?.coordinates?.length) continue;
    const [lon, lat] = geom.coordinates;
    const isFire = cat === "wildfires";
    const isStorm = cat === "severeStorms" || cat === "floods";
    if (!isFire && !isStorm) continue;

    out.push({
      id: `eonet-${ev.id}`,
      market: isFire ? "wildfire" : "disasters",
      title: ev.title,
      summary:
        ev.description ||
        `${ev.categories?.[0]?.title ?? "Event"} from NASA EONET` +
          (geom.magnitudeValue
            ? ` · ${geom.magnitudeValue} ${geom.magnitudeUnit ?? ""}`
            : ""),
      lat,
      lon,
      severity: isFire
        ? (geom.magnitudeValue ?? 0) > 2000
          ? "high"
          : "medium"
        : "medium",
      source: `EONET / ${ev.sources?.[0]?.id ?? "NASA"}`,
      sourceUrl: ev.sources?.[0]?.url,
      observedAt: geom.date,
      metrics: {
        category: ev.categories?.[0]?.title ?? cat,
        magnitude: geom.magnitudeValue ?? "n/a",
        unit: geom.magnitudeUnit ?? "",
      },
      xHints: [ev.title, isFire ? "wildfire evacuations" : "flood damage"],
    });
  }
  return out;
}

export async function collectLiveSignals(): Promise<SignalEvent[]> {
  const settled = await Promise.allSettled([
    fetchFloridaFloodSignals(),
    fetchEonetEvents(),
  ]);

  const flood = settled[0].status === "fulfilled" ? settled[0].value : [];
  const eonet = settled[1].status === "fulfilled" ? settled[1].value : [];

  const events = [...flood, ...eonet];

  // Deduplicate by id; prefer richer metric payloads
  const byId = new Map<string, SignalEvent>();
  for (const event of events) {
    const prev = byId.get(event.id);
    if (!prev) {
      byId.set(event.id, event);
      continue;
    }
    const prevScore = Object.keys(prev.metrics ?? {}).length;
    const nextScore = Object.keys(event.metrics ?? {}).length;
    if (nextScore >= prevScore) byId.set(event.id, event);
  }
  return [...byId.values()];
}
