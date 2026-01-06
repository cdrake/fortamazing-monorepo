// src/lib/images.ts
import { doc, getDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";
import { db, auth } from "@/config/firebase";

/**
 * HikeImage shape returned to UI
 */
export type HikeImage = {
  id?: string;
  url: string;
  filename?: string;
  path?: string; // original gs:// or storage path if present
  lat?: number;
  lng?: number;
  createdAt?: any;
  meta?: any;
};

/**
 * Resolve a gs:// or storage path to a Firebase Storage download URL.
 * - Accepts:
 *   - 'gs://bucket/path/to/object'  -> strips gs://<bucket>/ and uses remainder as storage path
 *   - 'users/uid/hikes/.../images/abc.jpg' -> used directly with storageRef
 * Returns undefined on failure.
 */
async function resolveStoragePathToDownloadUrl(pathOrGs?: string) {
  if (!pathOrGs || typeof pathOrGs !== "string") return undefined;
  try {
    const storage = getStorage();
    let path = pathOrGs.trim();

    // If full gs:// URI includes bucket, remove the leading gs://<bucket>/ if it contains the app bucket.
    // Accept either 'gs://<bucket>/path' or 'gs://path' (legacy).
    if (path.startsWith("gs://")) {
      // strip gs://
      path = path.replace(/^gs:\/\//, "");
      // if bucket prefix present like "my-bucket.appspot.com/path/...", and it matches storage.app.options.storageBucket,
      // remove the bucket segment.
      const bucketConfigured = (storage?.app?.options?.storageBucket ?? "").toString();
      if (bucketConfigured && path.startsWith(bucketConfigured + "/")) {
        path = path.substring(bucketConfigured.length + 1);
      } else {
        // If gs:// had only path (no bucket) or bucket mismatch, try using remainder as path.
        // e.g. gs://users/...
        // nothing more to do here.
      }
    }

    // now path should be a storage path relative to the bucket
    const ref = storageRef(storage, path);
    const dl = await getDownloadURL(ref);
    return dl;
  } catch (err) {
    console.warn("[resolveStoragePathToDownloadUrl] failed for", pathOrGs, err);
    return undefined;
  }
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
  const uid = ownerUid ?? auth?.currentUser?.uid;
  console.log("[listImagesForHike] start", { hikeId, ownerUid, resolvedUid: uid });

  if (!uid) {
    throw new Error("[listImagesForHike] no ownerUid supplied and no authenticated user available");
  }
  if (!hikeId) {
    throw new Error("[listImagesForHike] hikeId required");
  }

  // read the hike document
  try {
    const hikeRef = doc(db, "users", uid, "hikes", hikeId);
    console.log("[listImagesForHike] getDoc:", hikeRef.path);
    const hikeSnap = await getDoc(hikeRef);
    if (!hikeSnap.exists()) {
      console.warn("[listImagesForHike] hike doc not found:", hikeRef.path);
      return [];
    }

    const data: any = hikeSnap.data() ?? {};
    const imagesRaw: any[] = Array.isArray(data.images) ? data.images : [];

    // resolve each image to a download url
    const resolved: HikeImage[] = [];

    await Promise.all(
      imagesRaw.map(async (imgRaw: any, idx: number) => {
        try {
          // normalize different shapes:
          // - { url: "...", path?: "gs://..." , filename?: "..." }
          // - { path: "gs://..." }
          // - "gs://..." or "users/..." or direct http(s) url
          // - maybe store metadata in meta field
          let url: string | undefined;
          let path: string | undefined;
          let filename: string | undefined;
          let meta: any = undefined;

          if (!imgRaw) return;

          if (typeof imgRaw === "string") {
            // string entry: treat as path or url
            if (imgRaw.startsWith("http://") || imgRaw.startsWith("https://")) {
              url = imgRaw;
            } else {
              path = imgRaw;
            }
          } else if (typeof imgRaw === "object") {
            // object entry
            if (typeof imgRaw.url === "string" && imgRaw.url.length > 0) url = imgRaw.url;
            if (typeof imgRaw.path === "string" && imgRaw.path.length > 0) path = imgRaw.path;
            if (typeof imgRaw.filename === "string") filename = imgRaw.filename;
            if (imgRaw.meta) meta = imgRaw.meta;
            // fallback: sometimes image object is stored as { storagePath: "..." }
            if (!url && !path) {
              const altPath = (imgRaw.storagePath ?? imgRaw.storage_path ?? imgRaw.gsPath ?? imgRaw.gs_path) as string | undefined;
              if (typeof altPath === "string" && altPath.length > 0) path = altPath;
            }
          }

          // if we already have a direct url, use it
          if (url) {
            resolved.push({ id: String(idx), url, filename, path, meta });
            return;
          }

          // otherwise try to resolve path -> download url
          if (path) {
            // accept path like "gs://users/..." or "users/..." or "users/uid/..."
            const dl = await resolveStoragePathToDownloadUrl(path);
            if (dl) {
              resolved.push({ id: String(idx), url: dl, filename, path, meta });
              return;
            } else {
              console.warn("[listImagesForHike] failed to resolve storage path for image", { hikeId, idx, path });
              return;
            }
          }

          // nothing we could resolve
          console.warn("[listImagesForHike] skipping unknown image entry shape for index", idx, imgRaw);
          return;
        } catch (err) {
          console.warn("[listImagesForHike] per-image resolution failed", { hikeId, idx }, err);
          return;
        }
      })
    );

    console.log("[listImagesForHike] resolved images count:", resolved.length);
    return resolved;
  } catch (err: any) {
    console.error("[listImagesForHike] failed to read hike doc or resolve images", { hikeId, ownerUid: uid }, err);
    throw err;
  }
}
