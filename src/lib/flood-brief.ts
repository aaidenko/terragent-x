/**
 * Flood (disasters market) brief builder. Pure: every number in the output
 * comes from the event's own metrics (NWPS / NWS) or the EO result. No
 * river-stage defaults, no canned filler, and methods only list what ran.
 */
import type { EoAnalysis } from "./eo";
import { clipText } from "./text";
import type { SignalEvent } from "./types";

/** Max characters of NWS alert text quoted in a finding (word/sentence safe). */
export const FINDING_ALERT_TEXT_MAX = 700;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function human(category: string | null): string {
  return (category ?? "unknown").replace(/_/g, " ");
}

export type FloodBriefParts = {
  headline: string;
  finding: string;
  method: string[];
  metrics: Record<string, string | number>;
  limitations: string[];
  confidence: number;
};

export function buildFloodBrief(event: SignalEvent, eo?: EoAnalysis | null): FloodBriefParts {
  const m = event.metrics ?? {};
  const stage = num(m.stageFt);
  const floodStage = num(m.floodStageFt);
  const record = num(m.recordFt);
  const lid = str(m.site);
  const gaugeName = str(m.gaugeName);
  const isAlert = event.id.startsWith("nws-");
  const hasGauge = stage != null && lid != null;
  const hasGaugeComparison = hasGauge && floodStage != null;

  const method: string[] = [];
  const limitations: string[] = [];
  const metrics: Record<string, string | number> = {};
  const sentences: string[] = [];

  if (isAlert) {
    const event_ = str(m.event) ?? "NWS alert";
    method.push(
      `NWS ${event_} text and ${m.locationSource === "affected_zones_centroid" ? "affected-zone" : "warning-polygon"} centroid (${event.lat.toFixed(3)}, ${event.lon.toFixed(3)})`,
    );
    for (const k of [
      "event",
      "area",
      "floodKind",
      "vtec",
      "nwsSeverity",
      "nwsCertainty",
      "nwsUrgency",
      "onset",
      "ends",
      "expires",
      "locationSource",
      "linkedGauges",
    ]) {
      if (m[k] !== undefined && m[k] !== "") metrics[k] = m[k];
    }
    const headline = str(m.nwsHeadline);
    if (headline) sentences.push(`${headline.charAt(0)}${headline.slice(1).toLowerCase()}.`);
    if (event.summary) sentences.push(clipText(event.summary, FINDING_ALERT_TEXT_MAX));
  }

  if (hasGauge) {
    metrics.gaugeLid = lid!;
    if (gaugeName) metrics.gaugeName = gaugeName;
    if (str(m.usgsId)) metrics.usgsId = str(m.usgsId)!;
    metrics.stageFt = stage!;
    for (const k of [
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
    ]) {
      if (m[k] !== undefined) metrics[k] = m[k];
    }

    const cat = str(m.observedCategory);
    let s = `NWPS ${gaugeName ? `${gaugeName} ` : ""}(${lid}${str(m.usgsId) ? ` / USGS ${m.usgsId}` : ""}) observed ${stage!.toFixed(2)} ft`;
    if (str(m.observedAt)) s += ` at ${m.observedAt}`;
    if (cat) s += `, NWPS category ${human(cat)}`;
    if (floodStage != null) {
      const over = stage! - floodStage;
      s += ` (${Math.abs(over).toFixed(2)} ft ${over >= 0 ? "above" : "below"} the ${floodStage} ft flood stage)`;
    }
    sentences.push(`${s}.`);
    const fc = num(m.forecastStageFt);
    if (fc != null) {
      sentences.push(
        `Forecast ${fc.toFixed(2)} ft (${human(str(m.forecastCategory))})${str(m.forecastValidTime) ? ` by ${m.forecastValidTime}` : ""}.`,
      );
    }
    if (record != null && stage! > record) {
      sentences.push(
        `That is ${(stage! - record).toFixed(2)} ft above the highest NWPS historic crest (${record} ft${str(m.recordDate) ? `, ${m.recordDate}` : ""}).`,
      );
      metrics.aboveRecordFt = Number((stage! - record).toFixed(2));
    }

    method.push(
      hasGaugeComparison
        ? `NWPS ${lid} observed${num(m.forecastStageFt) != null ? " + forecast" : ""} stage vs NWPS flood categories${record != null ? " and historic crests" : ""}`
        : `Live stage reading at ${lid} (no NWPS flood categories available, so no threshold comparison)`,
    );
    if (isAlert) method.push(`Gauge ${lid} linked to this warning by NWS forecast-point name / polygon`);
    limitations.push("Gauge is a point reading; backwater and wind setup can change local depths");
  } else if (!event.summary && !isAlert) {
    sentences.push(event.title);
  }

  if (!hasGauge) {
    limitations.push("No river gauge is tied to this alert, so no stage or flood-category comparison was made");
  }

  if (eo?.ok && eo.recent) {
    metrics.ndwi_water_fraction = Number(eo.recent.water_fraction.toFixed(4));
    metrics.ndwi_mean = Number(eo.recent.ndwi_mean.toFixed(4));
    metrics.sentinel_scene = eo.recent.scene_id;
    metrics.sentinel_cloud_pct = Number(eo.recent.cloud_cover_pct.toFixed(2));
    metrics.sentinel_datetime = eo.recent.datetime;
    metrics.eo_model = eo.recent.model ?? "ndwi";
    if (eo.recent.mlp?.train_acc != null) metrics.mlp_train_acc = eo.recent.mlp.train_acc;
    if (eo.recent.mndwi_mean != null) metrics.mndwi_mean = Number(eo.recent.mndwi_mean.toFixed(4));
    if (eo.delta) {
      metrics.water_fraction_delta = Number(eo.delta.water_fraction_delta.toFixed(4));
    }
    const modelLabel =
      eo.recent.model === "weakly_supervised_mlp"
        ? `weakly-supervised MLP water classifier (train acc ${((eo.recent.mlp?.train_acc ?? 0) * 100).toFixed(1)}%)`
        : "NDWI+MNDWI fusion";
    sentences.push(
      `Sentinel-2 scene ${eo.recent.scene_id} (${eo.recent.datetime.slice(0, 10)}, cloud ${eo.recent.cloud_cover_pct.toFixed(1)}%) with SCL masking + ${modelLabel} estimates clear-pixel water fraction ${(eo.recent.water_fraction * 100).toFixed(2)}%` +
        (eo.delta
          ? ` (Δ ${(eo.delta.water_fraction_delta * 100).toFixed(2)} pp vs prior-month baseline).`
          : "."),
    );
    method.push(...(eo.method ?? []));
    limitations.push(...(eo.limitations ?? []));
    metrics.dataMode = hasGauge ? "live_gauge+eo" : "alert+eo";
  } else {
    limitations.push(
      eo?.error
        ? `Imagery unavailable (${eo.error}); no water-extent estimate in this brief`
        : "No satellite imagery analysed for this event in this run; no water-extent estimate",
    );
    metrics.dataMode = hasGauge ? "live_gauge" : "alert_only";
  }
  limitations.push("Parcel ownership not verified against county assessor in this pass");

  const label = gaugeName && lid ? `${gaugeName} (${lid})` : event.title;
  const headline =
    hasGauge && record != null && stage! > record
      ? `Above-record flood · ${label}`
      : hasGauge
        ? `River gauge flood brief · ${clipText(label, 90)}`
        : `Flood alert brief · ${clipText(event.title, 90)}`;

  return {
    headline,
    finding: sentences.join(" ").trim(),
    method,
    metrics,
    limitations,
    confidence: eo?.ok ? 0.86 : hasGaugeComparison ? 0.72 : 0.6,
  };
}
