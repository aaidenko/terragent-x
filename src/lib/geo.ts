/**
 * Small geometry helpers for GeoJSON alert polygons. No runtime imports.
 * Coordinates are GeoJSON order: [lon, lat].
 */

export type LonLat = [number, number];
export type Ring = LonLat[];
export type GeoJsonGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] }
  | { type: "Point"; coordinates: LonLat }
  | { type: string; coordinates?: unknown };

function ringAreaCentroid(ring: Ring): { a: number; cx: number; cy: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a /= 2;
  if (a === 0) {
    const n = ring.length || 1;
    return {
      a: 0,
      cx: ring.reduce((s, p) => s + p[0], 0) / n,
      cy: ring.reduce((s, p) => s + p[1], 0) / n,
    };
  }
  return { a, cx: cx / (6 * a), cy: cy / (6 * a) };
}

function polygonsOf(geom: GeoJsonGeometry | null | undefined): Ring[][] {
  if (!geom || !Array.isArray(geom.coordinates)) return [];
  if (geom.type === "Polygon") return [geom.coordinates as Ring[]];
  if (geom.type === "MultiPolygon") return geom.coordinates as Ring[][];
  return [];
}

/** Area-weighted centroid of a Polygon/MultiPolygon (outer rings). */
export function geometryCentroid(
  geom: GeoJsonGeometry | null | undefined,
): { lat: number; lon: number } | null {
  if (geom?.type === "Point" && Array.isArray(geom.coordinates)) {
    const [lon, lat] = geom.coordinates as LonLat;
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }
  const polys = polygonsOf(geom);
  let A = 0;
  let X = 0;
  let Y = 0;
  const fallback: LonLat[] = [];
  for (const poly of polys) {
    const outer = poly[0];
    if (!outer?.length) continue;
    const { a, cx, cy } = ringAreaCentroid(outer);
    fallback.push([cx, cy]);
    A += Math.abs(a);
    X += cx * Math.abs(a);
    Y += cy * Math.abs(a);
  }
  if (A > 0) return { lat: Y / A, lon: X / A };
  if (fallback.length) {
    return {
      lat: fallback.reduce((s, p) => s + p[1], 0) / fallback.length,
      lon: fallback.reduce((s, p) => s + p[0], 0) / fallback.length,
    };
  }
  return null;
}

/** Mean of several centroids (used for zone-based alerts). */
export function meanPoint(
  points: Array<{ lat: number; lon: number }>,
): { lat: number; lon: number } | null {
  if (!points.length) return null;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lon: points.reduce((s, p) => s + p.lon, 0) / points.length,
  };
}

function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInGeometry(
  lat: number,
  lon: number,
  geom: GeoJsonGeometry | null | undefined,
): boolean {
  for (const poly of polygonsOf(geom)) {
    if (!poly[0] || !pointInRing(lon, lat, poly[0])) continue;
    if (poly.slice(1).some((hole) => pointInRing(lon, lat, hole))) continue;
    return true;
  }
  return false;
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
