import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import * as turf from "@turf/turf";

/**
 * DayTrack type used across TrackDetail / TrackUploader / MapView
 */
export type DayTrack = {
  id: string;
  name: string;
  geojson: FeatureCollection<Geometry>;
  stats?: { distance_m: number; elevation: { min: number; max: number } | null; bounds?: [number, number, number, number] | null };
  color?: string;
  visible?: boolean;
  originalFile?: File | undefined;
};

// app/hikes/lib/trackUtils.ts

export function extractElevationsFromFeature(feature: Feature): number[] {
  if (!feature || !feature.geometry) return [];
  const g = feature.geometry as Geometry;

  const elevations: number[] = [];

  function pushFromCoords(coords: any) {
    // coords might be [lon, lat, ele] or [lon, lat] or objects
    if (!coords) return;
    if (Array.isArray(coords)) {
      // if nested arrays (MultiLineString / MultiPolygon), recurse
      if (Array.isArray(coords[0])) {
        for (const c of coords as any[]) pushFromCoords(c);
        return;
      }
      // coords is a single position
      // many GPX exports use [lon, lat, ele] (ele index 2)
      const ele = typeof coords[2] === "number" ? coords[2] : undefined;
      if (typeof ele === "number" && !Number.isNaN(ele)) elevations.push(ele);
    } else if (typeof coords === "object") {
      // maybe { lat, lon, ele } or {lat, lng, altitude}
      const ele =
        typeof (coords as any).ele === "number" ? (coords as any).ele
        : typeof (coords as any).elevation === "number" ? (coords as any).elevation
        : typeof (coords as any).alt === "number" ? (coords as any).alt
        : typeof (coords as any).altitude === "number" ? (coords as any).altitude
        : undefined;
      if (typeof ele === "number" && !Number.isNaN(ele)) elevations.push(ele);
    }
  }

  try {
    if (g.type === "LineString") {
      pushFromCoords((g as any).coordinates);
    } else if (g.type === "MultiLineString") {
      for (const line of (g as any).coordinates || []) pushFromCoords(line);
    } else if (g.type === "Polygon") {
      for (const ring of (g as any).coordinates || []) pushFromCoords(ring);
    } else if (g.type === "MultiPolygon") {
      for (const poly of (g as any).coordinates || []) for (const ring of poly) pushFromCoords(ring);
    } else if (g.type === "Point") {
      pushFromCoords((g as any).coordinates);
    } else if (g.type === "MultiPoint") {
      pushFromCoords((g as any).coordinates);
    }
  } catch (e) {
    // safe guard — return what we have so far
  }
  return elevations;
}


/**
 * computeStats - compute approximate total distance (meters), elevation min/max & bbox
 */
export function computeStats(fc: FeatureCollection<Geometry>) {
  let total = 0;
  const elev: number[] = [];
  try {
    for (const f of fc.features) {
      try {
        total += turf.length(f as any, { units: "kilometers" }) * 1000;
      } catch { /* ignore per-feature errors */ }
      const g: any = f.geometry;
      if (!g) continue;
      const coords: Position[] = [];
      if (g.type === "LineString") coords.push(...(g.coordinates as Position[]));
      else if (g.type === "MultiLineString") coords.push(...((g.coordinates as Position[][]).flat()));
      for (const p of coords) if (p && p.length > 2 && typeof p[2] === "number") elev.push(p[2]);
    }
  } catch (e) {
    // ignore
  }
  let bounds: [number, number, number, number] | null = null;
  try { bounds = turf.bbox(fc) as [number, number, number, number]; } catch { bounds = null; }
  return { distance_m: Math.round(total), elevation: elev.length ? { min: Math.min(...elev), max: Math.max(...elev) } : null, bounds };
}

/**
 * mergeDays - combine many DayTrack objects into a single FeatureCollection
 */
export function mergeDays(days: DayTrack[]) {
  const features = days.flatMap(d => d.geojson.features);
  return { type: "FeatureCollection", features } as FeatureCollection<Geometry>;
}

/**
 * getCombinedExtentFromDayTracks - returns bbox, sw, ne, center
 */
export function getCombinedExtentFromDayTracks(days: DayTrack[] | null) {
  if (!days || days.length === 0) return null;
  const combined = { type: "FeatureCollection", features: days.flatMap(d => d.geojson.features) } as FeatureCollection<Geometry>;
  try {
    const bbox = turf.bbox(combined); // [minLon, minLat, maxLon, maxLat]
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const sw = [minLat, minLon] as [number, number];
    const ne = [maxLat, maxLon] as [number, number];
    const center = [(minLat + maxLat) / 2, (minLon + maxLon) / 2] as [number, number];
    return { bbox, sw, ne, center };
  } catch {
    return null;
  }
}

/**
 * extractElevationsFromPoints - when given an array of points (latlng arrays or objects),
 * returns an array of numeric elevations when possible.
 */
export function extractElevationsFromPoints(points: any[]): number[] {
  const elevations: number[] = [];
  for (const p of points) {
    if (Array.isArray(p)) {
      const ele = p[2];
      if (typeof ele === "number") elevations.push(ele);
    } else if (p && typeof p === "object") {
      const ele = p.ele ?? p.alt ?? p.altitude ?? p[2];
      if (typeof ele === "number") elevations.push(ele);
    }
  }
  return elevations;
}

/**
 * waitForMap - small utility that polls a getter for a map instance for up to timeout
 */
export function waitForMap(mapRefGetter: ()=>any, timeoutMs = 5000, intervalMs = 150) {
  const start = Date.now();
  return new Promise<any | null>((resolve) => {
    const iv = setInterval(() => {
      const m = mapRefGetter();
      if (m) {
        clearInterval(iv);
        resolve(m);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        resolve(null);
      }
    }, intervalMs);
  });
}
