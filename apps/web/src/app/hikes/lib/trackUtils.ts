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

function isPosition(val: unknown): val is Position {
  return Array.isArray(val) && (val.length === 2 || val.length >= 3) && typeof val[0] === "number" && typeof val[1] === "number";
}

function isNumber(val: unknown): val is number {
  return typeof val === "number" && !Number.isNaN(val);
}

/**
 * extractElevationsFromFeature - extract numeric elevation values from a GeoJSON feature's geometry
 */
export function extractElevationsFromFeature(feature: Feature<Geometry>): number[] {
  if (!feature || !feature.geometry) return [];
  const g = feature.geometry;
  const elevations: number[] = [];

  function pushFromCoords(coords: unknown): void {
    if (coords == null) return;

    if (Array.isArray(coords)) {
      if (coords.length === 0) return;
      if (Array.isArray(coords[0])) {
        for (const c of coords) pushFromCoords(c);
        return;
      }
      if (isPosition(coords)) {
        const ele = coords[2];
        if (isNumber(ele)) elevations.push(ele);
      }
      return;
    }

    if (typeof coords === "object" && coords !== null) {
      const obj = coords as { [k: string]: unknown };
      const ele =
        isNumber(obj.ele) ? obj.ele
          : isNumber(obj.elevation) ? (obj.elevation as number)
          : isNumber(obj.alt) ? (obj.alt as number)
          : isNumber(obj.altitude) ? (obj.altitude as number)
          : undefined;
      if (isNumber(ele)) elevations.push(ele);
      return;
    }
  }

  try {
    // coordinates property is typed as unknown here then narrowed by pushFromCoords
    const coordsLike = (g as { coordinates?: unknown }).coordinates;
    switch (g.type) {
      case "LineString":
      case "MultiLineString":
      case "Polygon":
      case "MultiPolygon":
      case "Point":
      case "MultiPoint":
        pushFromCoords(coordsLike);
        break;
      default:
        break;
    }
  } catch {
    // swallow processing errors and return what we have so far
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
        total += turf.length(f as Feature, { units: "kilometers" }) * 1000;
      } catch {
        // ignore per-feature errors
      }

      const g = f.geometry;
      if (!g) continue;

      // gather coordinates safely by checking the runtime shapes
      const coordsArr: Position[] = [];
      const raw = (g as { coordinates?: unknown }).coordinates;

      if (g.type === "LineString" && Array.isArray(raw)) {
        coordsArr.push(...(raw as Position[]));
      } else if (g.type === "MultiLineString" && Array.isArray(raw)) {
        // raw is Position[][]
        for (const line of raw as unknown as unknown[]) {
          if (Array.isArray(line)) coordsArr.push(...(line as Position[]));
        }
      } else if (g.type === "Polygon" && Array.isArray(raw)) {
        // raw is Position[][]
        for (const ring of raw as unknown as unknown[]) {
          if (Array.isArray(ring)) coordsArr.push(...(ring as Position[]));
        }
      } else if (g.type === "MultiPolygon" && Array.isArray(raw)) {
        // raw is Position[][][]
        for (const poly of raw as unknown as unknown[]) {
          if (!Array.isArray(poly)) continue;
          for (const ring of poly as unknown as unknown[]) {
            if (Array.isArray(ring)) coordsArr.push(...(ring as Position[]));
          }
        }
      } else if (g.type === "Point") {
        if (isPosition(raw)) coordsArr.push(raw as Position);
      } else if (g.type === "MultiPoint" && Array.isArray(raw)) {
        coordsArr.push(...(raw as Position[]));
      }

      for (const p of coordsArr) {
        if (Array.isArray(p) && p.length > 2 && isNumber(p[2])) elev.push(p[2]);
      }
    }
  } catch {
    // ignore top-level errors
  }

  let bounds: [number, number, number, number] | null = null;
  try {
    bounds = turf.bbox(fc) as [number, number, number, number];
  } catch {
    bounds = null;
  }

  return {
    distance_m: Math.round(total),
    elevation: elev.length ? { min: Math.min(...elev), max: Math.max(...elev) } : null,
    bounds,
  };
}

/**
 * mergeDays - combine many DayTrack objects into a single FeatureCollection
 */
export function mergeDays(days: DayTrack[]) {
  const features = days.flatMap((d) => d.geojson.features);
  return { type: "FeatureCollection", features } as FeatureCollection<Geometry>;
}

/**
 * getCombinedExtentFromDayTracks - returns bbox, sw, ne, center
 */
export function getCombinedExtentFromDayTracks(days: DayTrack[] | null) {
  if (!days || days.length === 0) return null;
  const combined = { type: "FeatureCollection", features: days.flatMap((d) => d.geojson.features) } as FeatureCollection<Geometry>;
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
export function extractElevationsFromPoints(points: unknown[]): number[] {
  const elevations: number[] = [];
  for (const p of points) {
    if (Array.isArray(p)) {
      const ele = (p as unknown as Position)[2];
      if (isNumber(ele)) elevations.push(ele);
    } else if (p && typeof p === "object") {
      const obj = p as { [k: string]: unknown };
      const ele = isNumber(obj.ele) ? (obj.ele as number)
        : isNumber(obj.alt) ? (obj.alt as number)
        : isNumber(obj.altitude) ? (obj.altitude as number)
        : isNumber(obj[2]) ? (obj[2] as number)
        : undefined;
      if (isNumber(ele)) elevations.push(ele);
    }
  }
  return elevations;
}

/**
 * waitForMap - small utility that polls a getter for a map instance for up to timeout
 *
 * Generic: pass the expected map/viewer type if you want a typed return.
 */
export function waitForMap<T>(mapRefGetter: () => T | null, timeoutMs = 5000, intervalMs = 150): Promise<T | null> {
  const start = Date.now();
  return new Promise<T | null>((resolve) => {
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
