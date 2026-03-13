/**
 * activityFetcher.ts
 *
 * Consolidates the duplicated activity-document loading logic that was
 * scattered across TrackDetail and TrackUploader into reusable helpers.
 */

import type { FeatureCollection, Geometry } from "geojson"
import { doc, getDoc } from "firebase/firestore"
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage"
import { db } from "@/lib/firebase"
import type { DayTrack } from "./trackUtils"
import { computeStats } from "./trackUtils"

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** Shape of the raw Firestore activity document (untyped fields narrowed at call-site). */
type RawActivityData = Record<string, unknown>

/** A day entry as stored in the `days` array inside an activity doc. */
type RawDay = Record<string, unknown>

/** Resolved activity payload returned by fetchActivityWithAssets. */
export type ResolvedActivity = {
  id: string
  data: RawActivityData
  dayTracks: DayTrack[]
  combinedGeojson: FeatureCollection<Geometry>
  images: string[]
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/**
 * Resolve a GeoJSON FeatureCollection from a single `day` entry.
 *
 * Supports:
 * - Inline `geojson` object
 * - `geojsonUrl` (plain HTTPS)
 * - `geojsonPath` (gs:// or plain HTTPS)
 */
export async function resolveGeojsonFromDay(
  day: RawDay,
): Promise<FeatureCollection<Geometry>> {
  const empty: FeatureCollection<Geometry> = { type: "FeatureCollection", features: [] }

  if (day.geojson) return day.geojson as FeatureCollection<Geometry>

  if (day.geojsonUrl) {
    try {
      const resp = await fetch(day.geojsonUrl as string)
      return (await resp.json()) as FeatureCollection<Geometry>
    } catch {
      return empty
    }
  }

  if (day.geojsonPath) {
    try {
      const path = typeof day.geojsonPath === "string" ? day.geojsonPath : ""
      if (path.startsWith("gs://")) {
        const storage = getStorage()
        const r = storageRef(storage, path.replace(/^gs:\/\//, ""))
        const dl = await getDownloadURL(r)
        const resp = await fetch(dl)
        return (await resp.json()) as FeatureCollection<Geometry>
      }
      const resp = await fetch(path)
      return (await resp.json()) as FeatureCollection<Geometry>
    } catch {
      return empty
    }
  }

  return empty
}

/**
 * Resolve an array of image URLs from the `images` field of an
 * activity document.  Handles gs:// paths, plain URLs, and objects
 * with `url` / `path` properties.
 */
export async function resolveActivityImages(
  rawImages: unknown[] | undefined,
): Promise<string[]> {
  if (!Array.isArray(rawImages)) return []

  const resolved: string[] = []
  const storage = getStorage()

  for (const im of rawImages) {
    try {
      const entry = im as Record<string, unknown>
      const maybe = (entry.url ?? entry.path ?? im) as string
      if (typeof maybe === "string" && maybe.startsWith("gs://")) {
        const r = storageRef(storage, maybe.replace(/^gs:\/\//, ""))
        const dl = await getDownloadURL(r)
        resolved.push(dl)
      } else if (typeof maybe === "string") {
        resolved.push(maybe)
      }
    } catch {
      // skip per-image errors
    }
  }

  return resolved
}

// ----------------------------------------------------------------
// Main fetcher
// ----------------------------------------------------------------

/**
 * Fetch an activity document and resolve all associated assets
 * (GeoJSON day tracks + images) into ready-to-render structures.
 */
export async function fetchActivityWithAssets(
  uid: string,
  activityId: string,
): Promise<ResolvedActivity> {
  const docRef = doc(db, "users", uid, "activities", activityId)
  const snap = await getDoc(docRef)
  if (!snap.exists()) throw new Error("Activity not found")

  const data = snap.data() as RawActivityData

  // --- Day tracks ---
  const loadedDays: DayTrack[] = []
  const rawDays = data.days as RawDay[] | undefined

  if (Array.isArray(rawDays) && rawDays.length > 0) {
    for (let i = 0; i < rawDays.length; i++) {
      const d = rawDays[i]
      const fc = await resolveGeojsonFromDay(d)
      const stats = computeStats(fc)
      loadedDays.push({
        id: (d.id as string) ?? `day-${i}`,
        name: (d.name as string) ?? `Day ${i + 1}`,
        geojson: fc,
        stats,
        color: (d.color as string) ?? undefined,
        visible: typeof d.visible === "boolean" ? d.visible : true,
      })
    }
  } else {
    // Fallback: try combined geojson
    let combined: FeatureCollection<Geometry> | null = null
    try {
      if (data.combinedGeojson) {
        combined = data.combinedGeojson as FeatureCollection<Geometry>
      } else if (data.combinedUrl) {
        const storage = getStorage()
        let url = data.combinedUrl as string
        if (typeof url === "string" && url.startsWith("gs://")) {
          const r = storageRef(storage, url.replace(/^gs:\/\//, ""))
          url = await getDownloadURL(r)
        }
        const resp = await fetch(url)
        combined = (await resp.json()) as FeatureCollection<Geometry>
      }
    } catch {
      // ignore
    }

    if (combined) {
      combined.features.forEach((feat, idx) => {
        const single: FeatureCollection<Geometry> = { type: "FeatureCollection", features: [feat] }
        const stats = computeStats(single)
        loadedDays.push({
          id: `${activityId}-feat-${idx}`,
          name: `Part ${idx + 1}`,
          geojson: single,
          stats,
          color: undefined,
          visible: true,
        })
      })
    }
  }

  const combinedGeojson: FeatureCollection<Geometry> = {
    type: "FeatureCollection",
    features: loadedDays.flatMap((d) => d.geojson.features),
  }

  // --- Images ---
  const images = await resolveActivityImages(data.images as unknown[] | undefined)

  return { id: activityId, data, dayTracks: loadedDays, combinedGeojson, images }
}
