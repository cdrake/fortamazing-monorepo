// src/app/hikes/lib/hikeUploader.ts
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  doc as firestoreDoc,
  updateDoc,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import type { FeatureCollection, Geometry } from "geojson";
import type { DayTrack } from "./geo";

/**
 * saveAllWithStorage
 * - Uploads combined + per-day GeoJSON files to Storage
 * - Uploads images to Storage
 * - Creates a Firestore doc at users/{uid}/hikes/{hikeId} without storing raw geojson (no nested arrays)
 *
 * Returns { hikeId, combinedUrl, dayUrls, images }
 */
export async function saveAllWithStorage(opts: {
  title: string;
  descriptionMd?: string;
  imageFiles?: File[] | null;
  dayTracks: DayTrack[];
  combinedGeojson?: FeatureCollection<Geometry> | null;
  visibility?: "public" | "private";
}) {
  const {
    title,
    descriptionMd = "",
    imageFiles = [],
    dayTracks,
    combinedGeojson = null,
    visibility = "private",
  } = opts;

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const db = getFirestore();
  const storage = getStorage();

  // Build minimal days payload for the doc (no geojson objects included)
  const daysPayload = dayTracks.map((d) => ({
    id: d.id,
    name: d.name,
    // stats is allowed: numbers, objects, arrays of numbers (but NOT arrays-of-arrays)
    stats: d.stats,
    color: d.color,
    visible: d.visible,
    geojsonUrl: null as string | null, // will be updated after upload
  }));

  // Initial Firestore doc payload (no nested geojson)
  const docPayload: Record<string, any> = {
    title: title || `Multi-day hike: ${dayTracks.map((d) => d.name).join(", ")}`,
    descriptionMd: descriptionMd || "",
    createdAt: serverTimestamp(),
    owner: {
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
    },
    public: visibility === "public",
    days: daysPayload,
    combinedUrl: null,
    images: [],
  };

  // Create the document (so we have an id for storage paths)
  const hikesCol = collection(db, "users", user.uid, "hikes");
  const docRef = await addDoc(hikesCol, docPayload);
  const hikeId = docRef.id;

  // Collect uploaded items to return
  const uploadedImages: Array<{ filename: string; path: string; url: string; contentType?: string }> = [];
  const dayUrls: Record<string, string> = {};
  let combinedUrl: string | null = null;

  // 1) Upload combined geojson (if provided)
  if (combinedGeojson) {
    try {
      const combinedBlob = new Blob([JSON.stringify(combinedGeojson)], { type: "application/json" });
      const combinedPath = `hikes/${user.uid}/${hikeId}/combined.json`;
      const combinedRef = storageRef(storage, combinedPath);
      await uploadBytes(combinedRef, combinedBlob, {
        contentType: "application/json",
        // optional: metadata: { public: "false", ownerUid: user.uid }
      });
      combinedUrl = await getDownloadURL(combinedRef);
    } catch (e) {
      console.warn("Failed to upload combined geojson:", e);
      combinedUrl = null;
    }
  }

  // 2) Upload per-day geojson files (one file per dayTrack)
  for (const d of dayTracks) {
    try {
      const fc = d.geojson;
      if (!fc || !Array.isArray(fc.features) || fc.features.length === 0) {
        // skip empty geojson
        continue;
      }
      const dayBlob = new Blob([JSON.stringify(fc)], { type: "application/json" });
      const safeName = encodeURIComponent(d.id);
      const dayPath = `hikes/${user.uid}/${hikeId}/days/${safeName}.json`;
      const dayRef = storageRef(storage, dayPath);
      await uploadBytes(dayRef, dayBlob, { contentType: "application/json" });
      const url = await getDownloadURL(dayRef);
      dayUrls[d.id] = url;
    } catch (e) {
      console.warn(`Failed to upload geojson for day ${d.id}:`, e);
    }
  }

  // 3) Upload images (if any)
  if (imageFiles && imageFiles.length > 0) {
    for (const f of imageFiles) {
      try {
        const safeName = encodeURIComponent(f.name);
        const path = `hikes/${user.uid}/${hikeId}/images/${Date.now()}-${safeName}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, f, { contentType: f.type });
        const url = await getDownloadURL(ref);
        uploadedImages.push({ filename: f.name, path, url, contentType: f.type });
      } catch (e) {
        console.warn("Image upload failed for", f.name, e);
      }
    }
  }

  // 4) Patch the Firestore document with URLs (combinedUrl, per-day urls, images)
  try {
    // Build the updated days array: copy existing minimal day entry but set geojsonUrl if available
    const updatedDays = (daysPayload || []).map((d) => ({
      id: d.id,
      name: d.name,
      stats: d.stats,
      color: d.color,
      visible: d.visible,
      geojsonUrl: dayUrls[d.id] ?? null,
    }));

    const updateData: Record<string, any> = {};
    if (combinedUrl) updateData.combinedUrl = combinedUrl;
    updateData.days = updatedDays;
    if (uploadedImages.length) updateData.images = uploadedImages;

    await updateDoc(firestoreDoc(db, "users", user.uid, "hikes", hikeId), updateData);
  } catch (e) {
    console.warn("Failed to patch hike doc with uploaded URLs:", e);
  }

  return { hikeId, combinedUrl, dayUrls, images: uploadedImages };
}
