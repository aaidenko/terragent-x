import { geoEqualEarth } from "d3-geo";

/*
 * Shared, deterministic projection so the server-rendered land dots and the
 * client-rendered signal markers land on exactly the same pixels.
 */
export const MAP_W = 1000;
export const MAP_H = 487;

let cached: ReturnType<typeof geoEqualEarth> | null = null;

export function mapProjection() {
  if (!cached) {
    cached = geoEqualEarth().fitExtent(
      [
        [6, 6],
        [MAP_W - 6, MAP_H - 6],
      ],
      { type: "Sphere" },
    );
  }
  return cached;
}

export function project(lon: number, lat: number): [number, number] | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const p = mapProjection()([lon, lat]);
  // Round so server and client render byte-identical SVG (no hydration drift).
  return p ? [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100] : null;
}
