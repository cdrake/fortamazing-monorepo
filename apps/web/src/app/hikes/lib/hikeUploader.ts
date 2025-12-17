// src/lib/hikeUploader.ts
import { getAuth } from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  doc as docRef,
  getDoc,
  DocumentReference,
} from "firebase/firestore";
import type { FeatureCollection, Geometry } from "geojson";
import * as turf from "@turf/turf";
import { db } from "@/lib/firebase"; // adjust path to your project's firebase instance

// ----- Types -----
export type DayTrack = {
  id: string;
  name: string;
  geojson: FeatureCollection<Geometry>;
  stats: {
    distance_m: number;
    elevation: { min: number; max: number } | null;
    bounds: [number, number, number, number] | null;
  };
  color: string;
  visible: boolean;
  originalFile?: File; // optional, if you preserved the File
};

export type ExtentResult = {
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  sw: [number, number]; // [lat, lon]
  ne: [number, number]; // [lat, lon]
  center: [number, number]; // [lat, lon]
};

// ----- Helpers -----

/**
 * Try to resolve a friendly username for the currently signed-in user.
 * 1) Try user.displayName (if simple)
 * 2) Otherwise read Firestore users/{uid}.username
 * 3) Fallback to uid
 */
export async function getUsernameForCurrentUser(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  // 1) displayName if reasonable (no spaces, not an email)
  if (user.displayName) {
    const maybe = String(user.displayName).trim();
    if (maybe && !/\s/.test(maybe) && !maybe.includes("@")) return maybe;
  }

  // 2) Firestore users/{uid} -> username
  try {
    const profileRef = docRef(db, "users", user.uid);
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      const data = snap.data() as any;
      if (data?.username && typeof data.username === "string") return data.username;
    }
  } catch (e) {
    // ignore and fallback
  }

  // 3) fallback to uid
  return user.uid;
}

/**
 * Compute combined extent from DayTrack[] (returns null if no tracks)
 */
export function getCombinedExtentFromDayTracks(days: DayTrack[] | null): ExtentResult | null {
  if (!days || days.length === 0) return null;
  try {
    const combined: FeatureCollection = {
      type: "FeatureCollection",
      features: days.flatMap((d) => d.geojson.features),
    } as any;
    const bbox = turf.bbox(combined) as [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
    const [minLon, minLat, maxLon, maxLat] = bbox;
    // For sw/ne/center we use [lat, lon] pairs which are commonly expected by mapping libs
    const sw: [number, number] = [minLat, minLon];
    const ne: [number, number] = [maxLat, maxLon];
    const center: [number, number] = [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
    return { bbox, sw, ne, center };
  } catch (e) {
    return null;
  }
}

/**
 * Upload a single file to Storage with required customMetadata.ownerUid.
 * Returns download URL and storage path.
 */
export async function uploadHikeFile({
  username,
  hikeId,
  file,
}: {
  username: string;
  hikeId: string;
  file: File;
}): Promise<{ storagePath: string; downloadURL: string; size: number; mimeType: string; name: string }> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const storage = getStorage();
  const safeName = file.name.replace(/\s+/g, "_");
  const path = `users/${username}/hikes/${hikeId}/files/${safeName}`;
  const ref = storageRef(storage, path);

  const metadata = {
    contentType: file.type || "application/octet-stream",
    customMetadata: {
      ownerUid: user.uid,
    },
  };

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(ref, file, metadata);
    task.on(
      "state_changed",
      () => {
        // optional: emit progress
      },
      (err) => reject(err),
      () => resolve()
    );
  });

  const url = await getDownloadURL(ref);
  return { storagePath: path, downloadURL: url, size: file.size, mimeType: file.type, name: file.name };
}

/**
 * Upload a JS object as a JSON file to Storage and return small reference info.
 * Useful for storing big geojson blobs outside of Firestore.
 */
export async function uploadJSONToStorage({
  username,
  hikeId,
  filename,
  obj,
}: {
  username: string;
  hikeId: string;
  filename: string; // e.g. "day-0.geojson.json" or "combined.geojson.json"
  obj: any;
}): Promise<{ storagePath: string; downloadURL: string; size: number; name: string }> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const storage = getStorage();
  const safeName = filename.replace(/\s+/g, "_");
  const path = `users/${username}/hikes/${hikeId}/geojsons/${safeName}`;
  const ref = storageRef(storage, path);

  const jsonString = JSON.stringify(obj);
  const blob = new Blob([jsonString], { type: "application/json" });

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(ref, blob, {
      contentType: "application/json",
      customMetadata: {
        ownerUid: user.uid,
      },
    });
    task.on(
      "state_changed",
      () => {
        // progress optional
      },
      (err) => reject(err),
      () => resolve()
    );
  });

  const url = await getDownloadURL(ref);
  return { storagePath: path, downloadURL: url, size: blob.size, name: safeName };
}

/**
 * Save a multi-day hike:
 * - creates a Firestore doc under usersByName/{username}/hikes
 * - uploads original files (if DayTrack.originalFile present) with customMetadata.ownerUid
 * - uploads heavy geojson blobs to Storage and stores small file refs in the Firestore doc
 * - writes final document containing days[] (small), combined ref, extents, files[], summary
 */
export async function saveAllWithStorage({
  title,
  dayTracks,
  combinedGeojson,
}: {
  title?: string;
  dayTracks: DayTrack[];
  combinedGeojson?: FeatureCollection<Geometry> | null;
}): Promise<{ hikeId: string; username: string; docRef: DocumentReference }> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Must be signed in to save");

  const username = await getUsernameForCurrentUser();

  // 1) create a Firestore doc to reserve an id
  const hikesCol = collection(db, "usersByName", username, "hikes");
  const hikeDocRef = await addDoc(hikesCol, {
    title: title || `Multi-day hike: ${dayTracks.map((d) => d.name).join(", ")}`,
    ownerUid: user.uid,
    ownerUsername: username,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    public: true,
    days: [],
  });

  const hikeId = hikeDocRef.id;
  const uploadedFiles: Array<{ name: string; storagePath: string; downloadURL?: string; size?: number; mimeType?: string }> = [];

  // 2) upload original files (if originalFile present) - serial upload
  for (let i = 0; i < dayTracks.length; i++) {
    const dt = dayTracks[i];
    if (!dt.originalFile) continue;
    try {
      const res = await uploadHikeFile({ username, hikeId, file: dt.originalFile });
      uploadedFiles.push({
        name: res.name,
        storagePath: res.storagePath,
        downloadURL: res.downloadURL,
        size: res.size,
        mimeType: res.mimeType,
      });
    } catch (e) {
      console.error("upload failed for", dt.name, e);
      // propagate error so caller can handle retry/rollback
      throw e;
    }
  }

  // 3) upload each day's geojson to Storage (if present) and keep only references in Firestore
  const daysPayload: any[] = [];
  for (let i = 0; i < dayTracks.length; i++) {
    const d = dayTracks[i];
    const uploaded = uploadedFiles.find((f) => f.name === d.name || (d.originalFile && f.name === d.originalFile.name));

    const day: any = {
      name: d.name,
      dayIndex: i,
      color: d.color,
      stats: d.stats,
      visible: d.visible,
    };

    if (d.geojson) {
      try {
        const baseName = (d.name || `day-${i}`).replace(/[^\w\-_.]/g, "_");
        const fileName = `day-${i}_${baseName}.geojson.json`;
        const geoRes = await uploadJSONToStorage({ username, hikeId, filename: fileName, obj: d.geojson });
        day.geojsonFile = {
          storagePath: geoRes.storagePath,
          downloadURL: geoRes.downloadURL,
          size: geoRes.size,
          name: geoRes.name,
        };
      } catch (e) {
        console.error("failed to upload day geojson for", d.name, e);
        throw e;
      }
    }

    if (uploaded) {
      day.file = {
        name: uploaded.name,
        storagePath: uploaded.storagePath,
        downloadURL: uploaded.downloadURL,
        size: uploaded.size,
        mimeType: uploaded.mimeType,
      };
    }

    daysPayload.push(day);
  }

  // 4) upload combined geojson to Storage (if present)
  let combinedGeojsonFile: { storagePath: string; downloadURL: string; size: number; name: string } | null = null;
  if (combinedGeojson) {
    try {
      combinedGeojsonFile = await uploadJSONToStorage({
        username,
        hikeId,
        filename: `combined.geojson.json`,
        obj: combinedGeojson,
      });
    } catch (e) {
      console.error("failed to upload combined geojson", e);
      throw e;
    }
  }

  const extents = getCombinedExtentFromDayTracks(dayTracks);
  const totalDistance = dayTracks.reduce((s, d) => s + (d.stats?.distance_m || 0), 0);

  // 5) update the hike doc with final payload (small/doc-safe)
  await updateDoc(hikeDocRef, {
    days: daysPayload,
    combinedGeojsonFile: combinedGeojsonFile ? combinedGeojsonFile : null,
    files: uploadedFiles,
    extents,
    summary: { total_distance_m: totalDistance },
    updatedAt: serverTimestamp(),
  });

  return { hikeId, username, docRef: hikeDocRef };
}

/**
 * Client-side read pattern (example)
 * - If you need to display geojson, fetch it from the provided downloadURL
 *
 * Example usage:
 * const docSnap = await getDoc(hikeRef);
 * const hikeDoc = docSnap.data();
 * for (const day of hikeDoc.days) {
 *  if (day.geojsonFile?.downloadURL) {
 *    const r = await fetch(day.geojsonFile.downloadURL);
 *    const geojson = await r.json();
 *    // use geojson...
 *  }
 * }
 *
 * if (hikeDoc.combinedGeojsonFile?.downloadURL) {
 *  const r = await fetch(hikeDoc.combinedGeojsonFile.downloadURL);
 *  const combined = await r.json();
 * }
 */

