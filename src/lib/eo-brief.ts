import type { EoAnalysis, EoConfidenceLevel } from "./eo";
import type { AnalysisBrief } from "./types";

/** Brief confidence never exceeds what the imagery assessment supports. */
const CONFIDENCE_CAP: Record<EoConfidenceLevel, number> = {
  high: 0.9,
  medium: 0.75,
  low: 0.55,
};

const MAX_REASONS = 6;
const MAX_TEXT = 200;

function clean(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || /traceback|stderr|File "/i.test(t)) return null;
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1)}…` : t;
}

function isLevel(v: unknown): v is EoConfidenceLevel {
  return v === "low" || v === "medium" || v === "high";
}

function round4(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? Number(n.toFixed(4)) : null;
}

/**
 * Attach the pipeline's confidence/limitations/flood-delta to a brief.
 * Only values the pipeline computed are copied; nothing is estimated here.
 */
export function applyEoQuality(
  brief: AnalysisBrief,
  eo: EoAnalysis | null | undefined,
): AnalysisBrief {
  if (!eo) return brief;

  if (!eo.ok || !eo.recent) {
    brief.eoConfidence = {
      level: "low",
      reasons: ["Satellite imagery unavailable for this AOI; brief relies on gauge/alert data"],
    };
    brief.confidence = Math.min(brief.confidence, CONFIDENCE_CAP.low);
    return brief;
  }

  const level = isLevel(eo.confidence?.level) ? eo.confidence.level : "low";
  const reasons = (eo.confidence?.reasons ?? [])
    .map(clean)
    .filter((r): r is string => r !== null)
    .slice(0, MAX_REASONS);
  if (!isLevel(eo.confidence?.level)) {
    reasons.unshift("Imagery confidence not reported by pipeline");
  }
  brief.eoConfidence = { level, reasons };
  brief.confidence = Math.min(brief.confidence, CONFIDENCE_CAP[level]);

  const m = brief.metrics;
  m.eo_confidence = level;
  const r = eo.recent;
  const put = (k: string, v: unknown) => {
    const n = round4(v);
    if (n !== null) m[k] = n;
  };
  put("water_fraction_mndwi", r.water_fraction_mndwi);
  put("water_fraction_mlp", r.water_fraction_mlp);
  put("method_agreement_iou", r.method_agreement_iou);
  put("reference_water_fraction", r.reference?.ref_fraction);
  put("reference_recall", r.reference?.recall);
  if (eo.flood) {
    put("new_water_fraction", eo.flood.new_water_fraction_recent);
    put("new_water_delta", eo.flood.new_water_delta);
    put("new_water_noise_floor", eo.flood.noise_floor);
    m.new_water_significant = eo.flood.significant ? "yes" : "no";
  }

  const seen = new Set<string>();
  brief.limitations = brief.limitations
    .map(clean)
    .filter((l): l is string => l !== null && !seen.has(l) && (seen.add(l), true));
  return brief;
}
