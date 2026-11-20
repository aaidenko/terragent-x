import { geoContains } from "d3-geo";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import { MAP_H, MAP_W, mapProjection } from "./projection";

/*
 * Server-only: builds the dot-matrix Earth once per process and returns it as
 * a single compact SVG path ("M x y h0" per dot, drawn with round caps).
 * Only the resulting string reaches the client.
 */
const cache = new Map<number, string>();

export function landDotsPath(step = 9): string {
  const hit = cache.get(step);
  if (hit) return hit;

  const topo = land110 as unknown as Topology;
  const land = feature(topo, topo.objects.land) as unknown as FeatureCollection<
    Polygon | MultiPolygon
  >;
  const projection = mapProjection();
  const parts: string[] = [];

  for (let y = step / 2; y < MAP_H; y += step) {
    // Offset every other row for a woven, less mechanical texture.
    const row = Math.round(y / step);
    const offset = row % 2 ? step / 2 : 0;
    for (let x = step / 2 + offset; x < MAP_W; x += step) {
      const ll = projection.invert?.([x, y]);
      if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) continue;
      if (ll[1] < -58) continue; // trim Antarctica: it dominates the bottom edge
      if (geoContains(land, ll)) parts.push(`M${x.toFixed(1)} ${y.toFixed(1)}h0`);
    }
  }

  const d = parts.join("");
  cache.set(step, d);
  return d;
}
