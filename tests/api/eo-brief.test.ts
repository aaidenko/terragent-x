import { describe, expect, it } from "vitest";
import type { EoAnalysis } from "@/lib/eo";
import { applyEoQuality } from "@/lib/eo-brief";
import type { AnalysisBrief } from "@/lib/types";

const brief = (): AnalysisBrief => ({
  id: "b",
  eventId: "e",
  market: "disasters",
  headline: "h",
  finding: "f",
  confidence: 0.86,
  method: [],
  metrics: {},
  limitations: ["A", "A", 'Traceback (most recent call last): File "x"'],
  createdAt: "",
  mapHint: { lat: 0, lon: 0, label: "" },
});

const eo = (level: "low" | "medium" | "high"): EoAnalysis => ({
  ok: true,
  recent: {
    scene_id: "S2",
    datetime: "2026-11-08T00:00:00Z",
    cloud_cover_pct: 0,
    ndwi_mean: 0,
    ndwi_p90: 0,
    water_fraction: 0.26,
    valid_pixels: 1,
    collection: "c",
    source: "s",
    water_fraction_mndwi: 0.26,
    method_agreement_iou: 0.95,
    reference: { ref_fraction: 0.33, precision: 0.99, recall: 0.8, iou: 0.79 },
  },
  flood: {
    new_water_fraction_recent: 0.0011,
    new_water_fraction_baseline: 0.0025,
    new_water_delta: -0.0015,
    noise_floor: 0.01,
    significant: false,
  },
  confidence: { level, reasons: ["r1", "Traceback: boom"] },
});

describe("applyEoQuality", () => {
  it("caps numeric confidence by imagery level and copies computed metrics", () => {
    const b = applyEoQuality(brief(), eo("medium"));
    expect(b.confidence).toBe(0.75);
    expect(b.eoConfidence).toEqual({ level: "medium", reasons: ["r1"] });
    expect(b.metrics.new_water_delta).toBe(-0.0015);
    expect(b.metrics.new_water_significant).toBe("no");
    expect(b.metrics.reference_recall).toBe(0.8);
    expect(b.limitations).toEqual(["A"]);
  });
  it("marks unavailable imagery as low confidence", () => {
    const b = applyEoQuality(brief(), { ok: false, error: "EO analysis unavailable" });
    expect(b.eoConfidence?.level).toBe("low");
    expect(b.confidence).toBe(0.55);
  });
  it("leaves briefs without imagery untouched", () => {
    const b = applyEoQuality(brief(), undefined);
    expect(b.eoConfidence).toBeUndefined();
    expect(b.confidence).toBe(0.86);
  });
});
