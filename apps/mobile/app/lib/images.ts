// src/lib/images.ts
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore"
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage"

import { db, auth } from "@/config/firebase"

/**
 * HikeImage shape returned to UI
 */
export type HikeImage = {
  id?: string
  url: string
  filename?: string
  path?: string // original gs:// or storage path if present
  lat?: number
  lng?: number
  createdAt?: any
  meta?: any
}

/**
 * Resolve a gs:// or storage path to a Firebase Storage download URL.
 * - Accepts:
 *   - 'gs://bucket/path/to/object'  -> strips gs://<bucket>/ and uses remainder as storage path
 *   - 'users/uid/hikes/.../images/abc.jpg' -> used directly with storageRef
 * Returns undefined on failure.
 */
export async function resolveStoragePathToDownloadUrl(pathOrGs?: string) {
  if (!pathOrGs || typeof pathOrGs !== "string") return undefined
  try {
    const storage = getStorage()
    let path = pathOrGs.trim()

    // If full gs:// URI includes bucket, remove the leading gs://<bucket>/ if it contains the app bucket.
    // Accept either 'gs://<bucket>/path' or 'gs://path' (legacy).
    if (path.startsWith("gs://")) {
      // strip gs://
      path = path.replace(/^gs:\/\//, "")
      // if bucket prefix present like "my-bucket.appspot.com/path/...", and it matches storage.app.options.storageBucket,
      // remove the bucket segment.
      const bucketConfigured = (storage?.app?.options?.storageBucket ?? "").toString()
      if (bucketConfigured && path.startsWith(bucketConfigured + "/")) {
        path = path.substring(bucketConfigured.length + 1)
      } else {
        // If gs:// had only path (no bucket) or bucket mismatch, try using remainder as path.
        // e.g. gs://users/...
        // nothing more to do here.
      }
    }

    // now path should be a storage path relative to the bucket
    const ref = storageRef(storage, path)
    const dl = await getDownloadURL(ref)
    return dl
  } catch (err) {
    console.warn("[resolveStoragePathToDownloadUrl] failed for", pathOrGs, err)
    return undefined
  }
}

/**
 * Shape matching the shared ActivityPhoto type from packages/lib.
 * Duplicated here because mobile cannot import @fortamazing/lib directly.
 */
type ActivityPhoto = {
  path?: string
  url?: string
  filename?: string
  contentType?: string
  lat?: number | null
  lon?: number | null
  takenAt?: string
  meta?: Record<string, unknown>
}

/**
 * Parse EXIF GPS data to decimal degrees.
 * Handles both iOS (decimal) and Android (DMS rational) formats from expo-image-picker.
 */
export function parseExifGps(exif: Record<string, any>): { lat: number; lon: number } | null {
  const rawLat = exif.GPSLatitude
  const rawLon = exif.GPSLongitude
  const latRef = exif.GPSLatitudeRef ?? "N"
  const lonRef = exif.GPSLongitudeRef ?? "E"

  if (rawLat == null || rawLon == null) return null

  const toDec = (value: unknown): number | null => {
    if (typeof value === "number") return value
    // Android may provide a DMS string like "37/1,46/1,29.16/1"
    if (typeof value === "string") {
      const parts = value.split(",").map((p) => {
        const [num, den] = p.trim().split("/").map(Number)
        return den ? num / den : num
      })
      if (parts.length === 3) {
        return parts[0] + parts[1] / 60 + parts[2] / 3600
      }
      const n = Number(value)
      return isNaN(n) ? null : n
    }
    return null
  }

  const lat = toDec(rawLat)
  const lon = toDec(rawLon)
  if (lat == null || lon == null) return null

  return {
    lat: latRef === "S" ? -Math.abs(lat) : Math.abs(lat),
    lon: lonRef === "W" ? -Math.abs(lon) : Math.abs(lon),
  }
}

/**
 * Append an image metadata entry to the Firestore activity/hike document's `images` array.
 * Tries `activities` collection first, falls back to legacy `hikes`.
 */
export async function addImageMeta(activityId: string, photo: ActivityPhoto): Promise<void> {
  const uid = auth?.currentUser?.uid
  if (!uid) {
    throw new Error("[addImageMeta] no authenticated user")
  }

  // Try activities first, fall back to hikes (consistent with listImagesForHike)
  let docRef = doc(db, "users", uid, "activities", activityId)
  let snap = await getDoc(docRef)
  if (!snap.exists()) {
    docRef = doc(db, "users", uid, "hikes", activityId)
    snap = await getDoc(docRef)
  }
  if (!snap.exists()) {
    throw new Error(`[addImageMeta] document not found for ${activityId}`)
  }

  await updateDoc(docRef, { images: arrayUnion(photo) })
}

/**
 * listImagesForHike
 * - Reads the hike doc at users/{ownerUid}/hikes/{hikeId}
 * - Uses the doc's `images` array (if present)
 * - For each image entry:
 *     - if entry.url is a string -> use it
 *     - else if entry.path is a string -> attempt to convert via getDownloadURL
 *     - else if entry is a string -> attempt to treat it as path/url
 * - Returns an array of HikeImage (url required) — ignores images that can't be resolved.
 *
 * ownerUid optional: falls back to auth.currentUser.uid if omitted.
 */
export async function listImagesForHike(hikeId: string, ownerUid?: string): Promise<HikeImage[]> {
  const uid = ownerUid ?? auth?.currentUser?.uid
  console.log("[listImagesForHike] start", { hikeId, ownerUid, resolvedUid: uid })

  if (!uid) {
    throw new Error("[listImagesForHike] no ownerUid supplied and no authenticated user available")
  }
  if (!hikeId) {
    throw new Error("[listImagesForHike] hikeId required")
  }

  // read the hike document
  try {
    // Try activities collection first, fall back to hikes for legacy docs
    let hikeRef = doc(db, "users", uid, "activities", hikeId)
    console.log("[listImagesForHike] getDoc:", hikeRef.path)
    let hikeSnap = await getDoc(hikeRef)
    if (!hikeSnap.exists()) {
      // Fallback to legacy hikes collection
      hikeRef = doc(db, "users", uid, "hikes", hikeId)
      console.log("[listImagesForHike] fallback to hikes:", hikeRef.path)
      hikeSnap = await getDoc(hikeRef)
    }
    if (!hikeSnap.exists()) {
      console.warn("[listImagesForHike] doc not found in activities or hikes:", hikeId)
      return []
    }

    const data: any = hikeSnap.data() ?? {}
    const imagesRaw: any[] = Array.isArray(data.images) ? data.images : []

    // resolve each image to a download url
    const resolved: HikeImage[] = []

    await Promise.all(
      imagesRaw.map(async (imgRaw: any, idx: number) => {
        try {
          // normalize different shapes:
          // - { url: "...", path?: "gs://..." , filename?: "..." }
          // - { path: "gs://..." }
          // - "gs://..." or "users/..." or direct http(s) url
          // - maybe store metadata in meta field
          let url: string | undefined
          let path: string | undefined
          let filename: string | undefined
          let meta: any = undefined

          if (!imgRaw) return

          if (typeof imgRaw === "string") {
            // string entry: treat as path or url
            if (imgRaw.startsWith("http://") || imgRaw.startsWith("https://")) {
              url = imgRaw
            } else {
              path = imgRaw
            }
          } else if (typeof imgRaw === "object") {
            // object entry
            if (typeof imgRaw.url === "string" && imgRaw.url.length > 0) url = imgRaw.url
            if (typeof imgRaw.path === "string" && imgRaw.path.length > 0) path = imgRaw.path
            if (typeof imgRaw.filename === "string") filename = imgRaw.filename
            if (imgRaw.meta) meta = imgRaw.meta
            // fallback: sometimes image object is stored as { storagePath: "..." }
            if (!url && !path) {
              const altPath = (imgRaw.storagePath ??
                imgRaw.storage_path ??
                imgRaw.gsPath ??
                imgRaw.gs_path) as string | undefined
              if (typeof altPath === "string" && altPath.length > 0) path = altPath
            }
          }

          // if we already have a direct url, use it
          if (url) {
            resolved.push({ id: String(idx), url, filename, path, meta })
            return
          }

          // otherwise try to resolve path -> download url
          if (path) {
            // accept path like "gs://users/..." or "users/..." or "users/uid/..."
            const dl = await resolveStoragePathToDownloadUrl(path)
            if (dl) {
              resolved.push({ id: String(idx), url: dl, filename, path, meta })
              return
            } else {
              console.warn("[listImagesForHike] failed to resolve storage path for image", {
                hikeId,
                idx,
                path,
              })
              return
            }
          }

          // nothing we could resolve
          console.warn(
            "[listImagesForHike] skipping unknown image entry shape for index",
            idx,
            imgRaw,
          )
          return
        } catch (err) {
          console.warn("[listImagesForHike] per-image resolution failed", { hikeId, idx }, err)
          return
        }
      }),
    )

    console.log("[listImagesForHike] resolved images count:", resolved.length)
    return resolved
  } catch (err: any) {
    console.error(
      "[listImagesForHike] failed to read hike doc or resolve images",
      { hikeId, ownerUid: uid },
      err,
    )
    throw err
  }
}
