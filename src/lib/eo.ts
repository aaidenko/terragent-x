import { spawn } from "node:child_process";
import path from "node:path";

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
    threshold: number;
    collection: string;
    source: string;
  };
  baseline?: {
    scene_id: string;
    datetime: string;
    cloud_cover_pct: number;
    water_fraction: number;
    ndwi_mean: number;
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
    const child = spawn("python3", [script, argsJson], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({
        ok: false,
        error: "EO pipeline timed out",
        limitations: ["Sentinel NDWI exceeded time budget — gauge/alert fusion only"],
      });
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const line = stdout.trim().split("\n").filter(Boolean).at(-1) ?? "{}";
        resolve(JSON.parse(line) as EoAnalysis);
      } catch {
        resolve({
          ok: false,
          error: stderr.slice(0, 400) || "Failed to parse EO pipeline output",
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
  return runPython(JSON.stringify(input));
}
