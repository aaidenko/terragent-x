import { spawn } from "node:child_process";
import path from "node:path";
import { releaseEoSlot, tryAcquireEoSlot } from "./security";

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
  method?: string[];
  limitations?: string[];
};

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

    const child = spawn("python3", [script, argsJson], {
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
