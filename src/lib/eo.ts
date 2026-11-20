import { spawn } from "node:child_process";
import path from "node:path";
import { releaseEoSlot, tryAcquireEoSlot } from "./security";

export type EoConfidenceLevel = "low" | "medium" | "high";

export type EoConfidence = { level: EoConfidenceLevel; reasons: string[] };

export type EoFlood = {
  new_water_fraction_recent: number;
  new_water_fraction_baseline: number;
  new_water_delta: number;
  noise_floor: number;
  significant: boolean;
  definition?: string;
};

export type EoReferenceAgreement = {
  ref_fraction: number | null;
  precision: number | null;
  recall: number | null;
  iou: number | null;
};

export type EoAnalysis = {
  ok: boolean;
  error?: string;
  bbox?: number[];
  center?: { lat: number; lon: number };
  recent?: {
    scene_id: string;
    datetime: string;
    cloud_cover_pct: number;
    ndwi_mean: number;
    ndwi_p90: number;
    water_fraction: number;
    valid_pixels: number;
    threshold_ndwi?: number;
    threshold?: number;
    collection: string;
    source: string;
    model?: string;
    mlp?: {
      trained?: boolean;
      train_acc?: number;
      hidden?: number;
      epochs?: number;
    };
    mndwi_mean?: number;
    clear_pixel_fraction?: number;
    water_fraction_ndwi_only?: number;
    water_fraction_mndwi?: number;
    water_fraction_mlp?: number | null;
    method_agreement_iou?: number | null;
    reference?: EoReferenceAgreement | null;
    new_water_fraction?: number | null;
    bands?: string[];
  };
  baseline?: {
    scene_id: string;
    datetime: string;
    cloud_cover_pct: number;
    water_fraction: number;
    ndwi_mean: number;
    model?: string;
  } | null;
  delta?: {
    water_fraction_delta: number;
    ndwi_mean_delta: number;
  } | null;
  flood?: EoFlood | null;
  confidence?: EoConfidence;
  method?: string[];
  limitations?: string[];
};

/** TERRAGENT_PYTHON lets the host point at a venv with pipeline/requirements.txt. */
function pythonBin(): string {
  const configured = process.env.TERRAGENT_PYTHON?.trim();
  return configured && /^[\w./-]+$/.test(configured) ? configured : "python3";
}

function runPython(argsJson: string, timeoutMs = 90000): Promise<EoAnalysis> {
  const script = path.join(process.cwd(), "pipeline", "analyze_aoi.py");
  return new Promise((resolve) => {
    if (!tryAcquireEoSlot()) {
      resolve({
        ok: false,
        error: "EO pipeline busy",
        limitations: ["Another imagery job is running — try again shortly"],
      });
      return;
    }

    const child = spawn(pythonBin(), [script, argsJson], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    let stdout = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      releaseEoSlot();
      resolve({
        ok: false,
        error: "EO pipeline timed out",
        limitations: ["Sentinel NDWI exceeded time budget — gauge/alert fusion only"],
      });
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    // stderr intentionally discarded from client responses
    child.stderr.on("data", () => {});
    child.on("close", () => {
      clearTimeout(timer);
      releaseEoSlot();
      try {
        const line = stdout.trim().split("\n").filter(Boolean).at(-1) ?? "{}";
        const parsed = JSON.parse(line) as EoAnalysis & {
          trace?: unknown;
          error?: string;
        };
        delete parsed.trace;
        if (!parsed.ok) {
          parsed.error = "EO analysis unavailable";
        }
        resolve(parsed);
      } catch {
        resolve({
          ok: false,
          error: "EO analysis unavailable",
          limitations: ["EO parser failed — using non-imagery brief"],
        });
      }
    });
  });
}

export async function analyzeAoiNdwi(input: {
  lat: number;
  lon: number;
  pad_deg?: number;
}): Promise<EoAnalysis> {
  return runPython(
    JSON.stringify({
      lat: input.lat,
      lon: input.lon,
      pad_deg: input.pad_deg ?? 0.12,
    }),
  );
}
