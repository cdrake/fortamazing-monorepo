// app/lib/trackData.ts — Track data loading service
// Fetches and resolves GeoJSON for all days of a hike document.

import type { FeatureCollection, Geometry } from "geojson"

import {
  extractCoordinatesFromGeoJSON,
  computeTrackDistance,
  computeElevationMinMax,
  type LatLng,
} from "@/lib/geoUtils"
import { resolveStoragePathToDownloadUrl } from "@/lib/images"

const PALETTE = [
  "#e74c3c",
  "#f39c12",
  "#27ae60",
  "#2980b9",
  "#8e44ad",
  "#e67e22",
  "#1abc9c",
  "#c0392b",
]

export type DayTrack = {
  id: string
  name: string
  geojson: FeatureCollection<Geometry>
  stats: { distance_m: number; elevation: { min: number; max: number } | null }
  color: string
  visible: boolean
}

export type HikeTrackData = {
  dayTracks: DayTrack[]
  allCoordinates: LatLng[]
}

/**
 * Resolve a GeoJSON value — could be inline object, a URL string, or a storage path.
 */
async function resolveGeoJSON(
  inlineOrUrl: unknown,
  storagePath: unknown,
): Promise<FeatureCollection<Geometry> | null> {
  // 1) Inline GeoJSON object
  if (
    inlineOrUrl &&
    typeof inlineOrUrl === "object" &&
    (inlineOrUrl as Record<string, unknown>).type === "FeatureCollection"
  ) {
    return inlineOrUrl as FeatureCollection<Geometry>
  }

  // 2) Direct URL string (https://)
  if (typeof inlineOrUrl === "string" && inlineOrUrl.startsWith("http")) {
    try {
      const resp = await fetch(inlineOrUrl)
      return (await resp.json()) as FeatureCollection<Geometry>
    } catch (e) {
      console.warn("[trackData] failed to fetch geojson URL:", e)
    }
  }

  // 3) Storage path (gs:// or relative)
  const pathToResolve = storagePath ?? inlineOrUrl
  if (typeof pathToResolve === "string" && pathToResolve.length > 0) {
    try {
      const downloadUrl = await resolveStoragePathToDownloadUrl(pathToResolve)
      if (downloadUrl) {
        const resp = await fetch(downloadUrl)
        return (await resp.json()) as FeatureCollection<Geometry>
      }
    } catch (e) {
      console.warn("[trackData] failed to resolve storage path:", e)
    }
  }

  return null
}

/**
 * Load and compute track data from a raw hike document.
 * Returns empty dayTracks array if no track data exists.
 */
export async function loadHikeTrackData(hikeDoc: Record<string, unknown>): Promise<HikeTrackData> {
  const dayTracks: DayTrack[] = []
  const days = hikeDoc.days as Array<Record<string, unknown>> | undefined

  if (Array.isArray(days) && days.length > 0) {
    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      const geojson = await resolveGeoJSON(
        day.geojson ?? day.geojsonUrl ?? null,
        day.geojsonPath ?? null,
      )

      if (!geojson || !geojson.features || geojson.features.length === 0) continue

      const distance_m = Math.round(computeTrackDistance(geojson))
      const elevation = computeElevationMinMax(geojson)
      const color = (day.color as string) ?? PALETTE[i % PALETTE.length]
      const name = (day.name as string) ?? `Day ${i + 1}`

      dayTracks.push({
        id: (day.id as string) ?? `day-${i}`,
        name,
        geojson,
        stats: { distance_m, elevation },
        color,
        visible: true,
      })
    }
  }

  // Fallback: try combined geojson if no per-day tracks resolved
  if (dayTracks.length === 0) {
    const combinedGeojson = await resolveGeoJSON(
      hikeDoc.combinedGeojson ?? hikeDoc.combinedUrl ?? null,
      hikeDoc.combinedPath ?? null,
    )

    if (combinedGeojson && combinedGeojson.features && combinedGeojson.features.length > 0) {
      // Split features into individual "day" tracks
      for (let i = 0; i < combinedGeojson.features.length; i++) {
        const feat = combinedGeojson.features[i]
        const singleFc: FeatureCollection<Geometry> = {
          type: "FeatureCollection",
          features: [feat],
        }
        const distance_m = Math.round(computeTrackDistance(singleFc))
        const elevation = computeElevationMinMax(singleFc)

        dayTracks.push({
          id: `combined-${i}`,
          name: `Part ${i + 1}`,
          geojson: singleFc,
          stats: { distance_m, elevation },
          color: PALETTE[i % PALETTE.length],
          visible: true,
        })
      }
    }
  }

  const allCoordinates: LatLng[] = []
  for (const dt of dayTracks) {
    allCoordinates.push(...extractCoordinatesFromGeoJSON(dt.geojson))
  }

  return { dayTracks, allCoordinates }
}
