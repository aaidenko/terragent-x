#!/usr/bin/env node
/*
 * Grades raw satellite scenes into the deck's B&W look:
 * grayscale → contrast curve → ink-matched blacks (no pure black) → slight
 * cool tint toward the palette's slate → resized, progressive JPEG.
 *
 *   node scripts/grade-imagery.mjs <raw-dir> [out-dir]
 *
 * Expects files named florida|fire|terrain.(jpg|jpeg|png|tif); see public/imagery/CREDITS.md for sources.
 */
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [, , rawDir = ".imagery-raw", outDir = "public/imagery", only] = process.argv;
const SLOTS = only ? only.split(",") : ["florida", "fire", "terrain"];
const LONG_EDGE = 2600;

// Preferred source per slot (relative to raw-dir), when it differs from <slot>.*
const SOURCE = { florida: "alt/florida-iss.jpg" };

// Fractional crop [left, top, right, bottom] to trim no-data edges and captions.
const CROP = {
  terrain: [0.035, 0.01, 0.965, 0.99],
  flood: [0.03, 0, 0.97, 1],
  forest: [0.08, 0.02, 0.98, 0.8],
  mine: [0, 0, 1, 0.955],
};

// Ink #1c1e24 as the floor, paper #f4f5f6 as the ceiling.
const FLOOR = 26;
const CEIL = 244;

await mkdir(outDir, { recursive: true });
const files = await readdir(rawDir);

for (const slot of SLOTS) {
  const file = SOURCE[slot] ?? files.find((f) => path.parse(f).name.toLowerCase() === slot);
  if (!file) {
    console.warn(`skip ${slot}: no raw file`);
    continue;
  }
  const src = path.join(rawDir, file);
  const out = path.join(outDir, `${slot}.jpg`);

  const meta = await sharp(src, { limitInputPixels: false }).metadata();
  const W = meta.width ?? 1;
  const H = meta.height ?? 1;
  const [l, t, r, b] = CROP[slot] ?? [0, 0, 1, 1];
  const region = {
    left: Math.round(W * l),
    top: Math.round(H * t),
    width: Math.round(W * (r - l)),
    height: Math.round(H * (b - t)),
  };
  const base = sharp(src, { limitInputPixels: false }).rotate().flatten({ background: "#1c1e24" }).extract(region);
  const landscape = region.width >= region.height;

  // Normalise to full range, then compress into the ink→paper window with a
  // gentle S-curve (gamma > 1 deepens mids, the linear step lifts the floor).
  const scale = (CEIL - FLOOR) / 255;
  await base
    .resize(landscape ? { width: LONG_EDGE, withoutEnlargement: true } : { height: LONG_EDGE, withoutEnlargement: true })
    .grayscale()
    .normalise({ lower: 1, upper: 99 })
    .gamma(1.18)
    .linear(1.12, -12)
    .linear(scale, FLOOR)
    .toColourspace("srgb")
    .tint({ r: 190, g: 198, b: 210 })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(out);

  const m = await sharp(out).metadata();
  console.log(`graded ${slot} → ${out} (${m.width}×${m.height})`);
}
