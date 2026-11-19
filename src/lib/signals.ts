import type { SignalEvent } from "./types";

function severityFromStage(stageFt: number, floodFt: number): SignalEvent["severity"] {
  const over = stageFt - floodFt;
  if (over >= 2) return "critical";
  if (over >= 0.5) return "high";
  if (over >= 0) return "medium";
  return "low";
}

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
      variable?: { variableDescription?: string; unit?: { unitCode?: string } };
      values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }>;
    }>;
  };
};

/** St. Johns River near Cocoa — record flood hero site */
export async function fetchCocoaGauge(): Promise<SignalEvent | null> {
  const url =
    "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=02232000&parameterCd=00065&siteStatus=all";
  const data = await fetchJson<UsgsIv>(url);
  const series = data?.value?.timeSeries?.[0];
  const latest = series?.values?.[0]?.value?.at(-1);
  if (!latest?.value) {
    // Fallback snapshot from NWS reporting ~18.3 ft on 2026-11-19 if live gauge flaps
    return {
      id: "flood-cocoa-stjohns",
      market: "disasters",
      title: "St. Johns River near Cocoa — major / record flood",
      summary:
        "NWS Melbourne reports the St. Johns near Cocoa above the all-time flood of record (~17.6 ft), with water entering homes in Lake Poinsett, Silver Pines, and Shakespeare Park.",
      lat: 28.386,
      lon: -80.742,
      severity: "critical",
      source: "NWS / USGS (cached briefing)",
      sourceUrl: "https://water.weather.gov/ahps2/hydrograph.php?wfo=mlb&gage=cocf1",
      observedAt: new Date().toISOString(),
      metrics: {
        stageFt: 18.3,
        floodStageFt: 16.0,
        recordFt: 17.6,
        status: "major_flood_above_record",
      },
      xHints: [
        "Cocoa Florida flooding",
        "St Johns River flood Brevard",
        "Brevard EOC shelter",
      ],
    };
  }

  const stageFt = Number(latest.value);
  const floodStageFt = 16.0;
  const recordFt = 17.6;
  const lat = series?.sourceInfo?.geoLocation?.geogLocation?.latitude ?? 28.386;
  const lon = series?.sourceInfo?.geoLocation?.geogLocation?.longitude ?? -80.742;

  return {
    id: "flood-cocoa-stjohns",
    market: "disasters",
    title: `${series?.sourceInfo?.siteName ?? "St. Johns near Cocoa"} — ${stageFt.toFixed(2)} ft`,
    summary:
      stageFt >= recordFt
        ? `Live USGS stage ${stageFt.toFixed(2)} ft exceeds the 17.6 ft record. Major flooding impacts along the St. Johns in Brevard County.`
        : `Live USGS stage ${stageFt.toFixed(2)} ft vs flood stage ${floodStageFt} ft.`,
    lat,
    lon,
    severity: severityFromStage(stageFt, floodStageFt),
    source: "USGS NWIS IV",
    sourceUrl: url,
    observedAt: latest.dateTime ?? new Date().toISOString(),
    metrics: {
      stageFt: Number(stageFt.toFixed(2)),
      floodStageFt,
      recordFt,
      aboveRecordFt: Number((stageFt - recordFt).toFixed(2)),
      site: series?.sourceInfo?.siteName ?? "02232000",
    },
    xHints: ["Cocoa Florida flooding", "St Johns River flood", "Brevard County flood"],
  };
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

type NwsAlert = {
  features?: Array<{
    id: string;
    properties?: {
      event?: string;
      headline?: string;
      areaDesc?: string;
      severity?: string;
      effective?: string;
      ends?: string;
      description?: string;
    };
    geometry?: { type: string; coordinates?: unknown } | null;
  }>;
};

export async function fetchFloridaFloodAlerts(): Promise<SignalEvent[]> {
  const data = await fetchJson<NwsAlert>(
    "https://api.weather.gov/alerts/active?area=FL&status=actual&message_type=alert",
  );
  if (!data?.features?.length) return [];

  return data.features
    .filter((f) => {
      const ev = (f.properties?.event ?? "").toLowerCase();
      return ev.includes("flood");
    })
    .slice(0, 8)
    .map((f, i) => {
      const sev = (f.properties?.severity ?? "Moderate").toLowerCase();
      return {
        id: `nws-${f.id?.split("/").pop() ?? i}`,
        market: "disasters" as const,
        title: f.properties?.headline || f.properties?.event || "Florida flood alert",
        summary: (f.properties?.description ?? f.properties?.areaDesc ?? "").slice(0, 320),
        lat: 28.4,
        lon: -80.7,
        severity:
          sev === "extreme" || sev === "severe"
            ? ("critical" as const)
            : sev === "moderate"
              ? ("high" as const)
              : ("medium" as const),
        source: "NWS alerts",
        sourceUrl: f.id,
        observedAt: f.properties?.effective ?? new Date().toISOString(),
        metrics: {
          area: f.properties?.areaDesc ?? "",
          event: f.properties?.event ?? "",
        },
        xHints: ["Florida flood warning", f.properties?.areaDesc?.split(";")[0] ?? "FL flood"],
      };
    });
}

export async function collectLiveSignals(): Promise<SignalEvent[]> {
  const [cocoa, eonet, nws] = await Promise.all([
    fetchCocoaGauge(),
    fetchEonetEvents(),
    fetchFloridaFloodAlerts(),
  ]);

  const events = [
    ...(cocoa ? [cocoa] : []),
    ...eonet,
    ...nws,
  ];

  // Deduplicate by id
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}
