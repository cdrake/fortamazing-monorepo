// app/lib/geoUtils.ts — Lightweight geo utilities for react-native-maps
// Replaces @turf/turf with Haversine math to keep bundle small.

import type { FeatureCollection, Geometry, Position } from "geojson"

/** Coordinate format used by react-native-maps */
export type LatLng = { latitude: number; longitude: number }

/** Region format used by react-native-maps */
export type Region = {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

const DEG_TO_RAD = Math.PI / 180
const EARTH_RADIUS_M = 6_371_000

/**
 * Haversine distance between two points in meters.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD
  const dLon = (lon2 - lon1) * DEG_TO_RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Extract {latitude, longitude} array from a GeoJSON FeatureCollection.
 * Handles LineString and MultiLineString geometries.
 * GeoJSON uses [lon, lat] — this swaps to {latitude, longitude}.
 */
export function extractCoordinatesFromGeoJSON(fc: FeatureCollection<Geometry>): LatLng[] {
  const coords: LatLng[] = []
  for (const feature of fc.features) {
    const g = feature.geometry
    if (!g) continue
    const raw = (g as { coordinates?: unknown }).coordinates
    if (!raw || !Array.isArray(raw)) continue

    if (g.type === "LineString") {
      for (const pos of raw as Position[]) {
        coords.push({ latitude: pos[1], longitude: pos[0] })
      }
    } else if (g.type === "MultiLineString") {
      for (const line of raw as Position[][]) {
        for (const pos of line) {
          coords.push({ latitude: pos[1], longitude: pos[0] })
        }
      }
    } else if (g.type === "Point") {
      const pos = raw as unknown as Position
      if (pos.length >= 2) {
        coords.push({ latitude: pos[1], longitude: pos[0] })
      }
    }
  }
  return coords
}

/**
 * Compute total track distance in meters using Haversine over all coordinate pairs.
 */
export function computeTrackDistance(fc: FeatureCollection<Geometry>): number {
  let total = 0
  for (const feature of fc.features) {
    const g = feature.geometry
    if (!g) continue
    const raw = (g as { coordinates?: unknown }).coordinates
    if (!raw || !Array.isArray(raw)) continue

    const lines: Position[][] = []
    if (g.type === "LineString") {
      lines.push(raw as Position[])
    } else if (g.type === "MultiLineString") {
      lines.push(...(raw as Position[][]))
    }

    for (const line of lines) {
      for (let i = 1; i < line.length; i++) {
        total += haversineDistance(line[i - 1][1], line[i - 1][0], line[i][1], line[i][0])
      }
    }
  }
  return total
}

/**
 * Extract min/max elevation from GeoJSON Z coordinates (3rd element in [lon, lat, elev]).
 * Returns null if no elevation data found.
 */
export function computeElevationMinMax(
  fc: FeatureCollection<Geometry>,
): { min: number; max: number } | null {
  const elevations: number[] = []

  for (const feature of fc.features) {
    const g = feature.geometry
    if (!g) continue
    const raw = (g as { coordinates?: unknown }).coordinates
    if (!raw || !Array.isArray(raw)) continue

    const positions: Position[] = []
    if (g.type === "LineString") {
      positions.push(...(raw as Position[]))
    } else if (g.type === "MultiLineString") {
      for (const line of raw as Position[][]) {
        positions.push(...line)
      }
    } else if (g.type === "Point") {
      positions.push(raw as unknown as Position)
    }

    for (const pos of positions) {
      if (pos.length > 2 && typeof pos[2] === "number" && !Number.isNaN(pos[2])) {
        elevations.push(pos[2])
      }
    }
  }

  if (elevations.length === 0) return null
  return { min: Math.min(...elevations), max: Math.max(...elevations) }
}

/**
 * Compute a react-native-maps Region that encompasses all coordinates.
 * Adds padding via a 20% expansion of deltas.
 */
export function computeBoundsRegion(coords: LatLng[]): Region | null {
  if (coords.length === 0) return null

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  for (const c of coords) {
    if (c.latitude < minLat) minLat = c.latitude
    if (c.latitude > maxLat) maxLat = c.latitude
    if (c.longitude < minLng) minLng = c.longitude
    if (c.longitude > maxLng) maxLng = c.longitude
  }

  const latDelta = Math.max((maxLat - minLat) * 1.2, 0.005)
  const lngDelta = Math.max((maxLng - minLng) * 1.2, 0.005)

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  }
}
