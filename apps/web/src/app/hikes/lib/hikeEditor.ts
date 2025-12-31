// lib/hikeEditor.ts
"use client";

import { getAuth } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type DayEntry = {
  id: string;
  name?: string;
  // either inline geojson object or a "geojsonUrl" or "geojsonPath" (gs:// style)
  geojson?: any;
  geojsonUrl?: string; // http(s) url
  geojsonPath?: string; // gs:// path or storage path
  stats?: any;
  color?: string | null;
  visible?: boolean;
};

export type ImageEntry = {
  path?: string; // gs:// path or storage path
  url?: string; // (optional) download url
  meta?: any;
};

export type CreateHikeOptions = {
  ownerUid?: string; // defaults to current user
  title?: string;
  descriptionMd?: string;
  visibility?: "private" | "public";
  storeDownloadUrls?: boolean; // if true - store HTTP download URLs in the doc; else store gs:// path
};

export type AppendToHikeOptions = {
  hikeId: string;
  ownerUid?: string; // defaults to current user
  storeDownloadUrls?: boolean;
};

/**
 * Helper - upload a blob/file to Firebase Storage and return both storage path and download URL (if requested).
 * - destPath should be a storage path WITHOUT leading "gs://", e.g. "users/<uid>/hikes/<hikeId>/images/..."
 */
async function _uploadToStorage(file: File | Blob, destPath: string, returnDownloadUrl = false) {
  const storage = getStorage();
  const ref = storageRef(storage, destPath);
  await uploadBytes(ref, file);
  const gsPath = `gs://${(ref as any)._location?.path ?? destPath}`;
  if (returnDownloadUrl) {
    try {
      const dl = await getDownloadURL(ref);
      return { gsPath, downloadUrl: dl };
    } catch (e) {
      // if we can't get a download URL right away, still return gsPath
      return { gsPath, downloadUrl: undefined };
    }
  }
  return { gsPath, downloadUrl: undefined };
}

/**
 * createHikeWithStorage
 * - Creates a new hike doc under users/{ownerUid}/hikes/{generatedId}
 * - Uploads combinedGeojson (optional), per-day geojsons (if provided as inline), and image files.
 * - Returns { hikeId, docRef, uploaded: { days: DayEntry[], images: ImageEntry[] } }
 */
export async function createHikeWithStorage(params: {
  title?: string;
  descriptionMd?: string;
  ownerUid?: string;
  dayTracks?: DayEntry[]; // can include inline geojson
  combinedGeojson?: any; // optional combined fc
  imageFiles?: File[]; // optional image files to upload
  visibility?: "private" | "public";
  storeDownloadUrls?: boolean;
}) {
  const {
    title,
    descriptionMd,
    ownerUid,
    dayTracks = [],
    combinedGeojson,
    imageFiles = [],
    visibility = "private",
    storeDownloadUrls = false,
  } = params;

  const authUser = getAuth().currentUser;
  const uid = ownerUid ?? authUser?.uid;
  if (!uid) throw new Error("No owner UID available (sign-in required)");

  // create new doc id under users/{uid}/hikes/{id}
  const hikesCol = collection(db, "users", uid, "hikes");
  const newDocRef = doc(hikesCol); // auto-id
  const hikeId = newDocRef.id;

  const uploadedDays: DayEntry[] = [];
  const uploadedImages: ImageEntry[] = [];

  // 1) upload any inline dayTracks (geojson objects) to storage and prepare DayEntry records
  for (let i = 0; i < dayTracks.length; i++) {
    const d = dayTracks[i];
    if (d.geojson) {
      const filename = `users/${uid}/hikes/${hikeId}/days/day-${Date.now()}-${i}.geojson`;
      const blob = new Blob([JSON.stringify(d.geojson)], { type: "application/json" });
      const uploaded = await _uploadToStorage(blob, filename, storeDownloadUrls);
      const entry: DayEntry = {
        id: d.id ?? `day-${Date.now()}-${i}`,
        name: d.name,
        geojsonPath: uploaded.gsPath,
        geojsonUrl: uploaded.downloadUrl,
        stats: d.stats ?? null,
        color: d.color ?? null,
        visible: typeof d.visible === "boolean" ? d.visible : true,
      };
      uploadedDays.push(entry);
    } else {
      // already has url/path — pass through
      uploadedDays.push(d);
    }
  }

  // 2) upload combinedGeojson (optional)
  let combinedPath: string | undefined = undefined;
  let combinedUrl: string | undefined = undefined;
  if (combinedGeojson) {
    const filename = `users/${uid}/hikes/${hikeId}/combined/${Date.now()}.geojson`;
    const blob = new Blob([JSON.stringify(combinedGeojson)], { type: "application/json" });
    const uploaded = await _uploadToStorage(blob, filename, storeDownloadUrls);
    combinedPath = uploaded.gsPath;
    combinedUrl = uploaded.downloadUrl;
  }

  // 3) upload images (if any)
  for (let i = 0; i < imageFiles.length; i++) {
    const f = imageFiles[i];
    const dest = `users/${uid}/hikes/${hikeId}/images/${Date.now()}-${i}-${f.name}`;
    const uploaded = await _uploadToStorage(f, dest, storeDownloadUrls);
    uploadedImages.push({ path: uploaded.gsPath, url: uploaded.downloadUrl });
  }

  // 4) create the hike document
  const docPayload: any = {
    title: title ?? `Hike ${new Date().toISOString()}`,
    descriptionMd: descriptionMd ?? "",
    owner: { uid }, // optionally include more owner info
    createdAt: serverTimestamp(),
    public: visibility === "public",
    days: uploadedDays.length ? uploadedDays : [],
    images: uploadedImages.length ? uploadedImages : [],
  };
  if (combinedPath) docPayload.combinedPath = combinedPath;
  if (combinedUrl) docPayload.combinedUrl = combinedUrl;

  await setDoc(newDocRef, docPayload);

  return {
    hikeId,
    docRef: newDocRef,
    uploaded: {
      days: uploadedDays,
      images: uploadedImages,
      combinedPath,
      combinedUrl,
    },
  };
}

/**
 * appendToHikeWithStorage
 * - Adds new days (parsed GPX/KML output), and image files to an existing hike doc.
 * - It uploads files to storage and appends metadata to the hike's `days` and `images` arrays (using arrayUnion).
 *
 * options:
 *  - hikeId: required
 *  - ownerUid: optional; defaults to current user
 *  - dayTracks: DayEntry[] - inline geojsons or DayEntry objects
 *  - imageFiles: File[]
 *  - storeDownloadUrls: boolean
 *
 * Returns info about uploaded items.
 */
export async function appendToHikeWithStorage(options: {
  hikeId: string;
  ownerUid?: string;
  dayTracks?: DayEntry[];
  imageFiles?: File[];
  storeDownloadUrls?: boolean;
}) {
  const { hikeId, ownerUid, dayTracks = [], imageFiles = [], storeDownloadUrls = false } = options;
  const authUser = getAuth().currentUser;
  const uid = ownerUid ?? authUser?.uid;
  if (!uid) throw new Error("No owner UID available (sign-in required)");

  const hikeDocRef = doc(db, "users", uid, "hikes", hikeId);
  const hikeDoc = await getDoc(hikeDocRef);
  if (!hikeDoc.exists()) throw new Error("Hike doc not found");

  const uploadedDays: DayEntry[] = [];
  const uploadedImages: ImageEntry[] = [];

  // upload dayTracks (inline geojsons) and prepare entries
  for (let i = 0; i < dayTracks.length; i++) {
    const d = dayTracks[i];
    if (d.geojson) {
      const filename = `users/${uid}/hikes/${hikeId}/days/day-${Date.now()}-${i}.geojson`;
      const blob = new Blob([JSON.stringify(d.geojson)], { type: "application/json" });
      const uploaded = await _uploadToStorage(blob, filename, storeDownloadUrls);
      uploadedDays.push({
        id: d.id ?? `day-${Date.now()}-${i}`,
        name: d.name,
        geojsonPath: uploaded.gsPath,
        geojsonUrl: uploaded.downloadUrl,
        stats: d.stats ?? null,
        color: d.color ?? null,
        visible: typeof d.visible === "boolean" ? d.visible : true,
      });
    } else {
      // pass-through existing DayEntry (no upload)
      uploadedDays.push(d);
    }
  }

  // upload images
  for (let i = 0; i < imageFiles.length; i++) {
    const f = imageFiles[i];
    const dest = `users/${uid}/hikes/${hikeId}/images/${Date.now()}-${i}-${f.name}`;
    const uploaded = await _uploadToStorage(f, dest, storeDownloadUrls);
    uploadedImages.push({ path: uploaded.gsPath, url: uploaded.downloadUrl });
  }

  // update doc using arrayUnion
  const updates: any = {};
  if (uploadedDays.length) updates.days = arrayUnion(...uploadedDays);
  if (uploadedImages.length) updates.images = arrayUnion(...uploadedImages);

  if (Object.keys(updates).length) {
    await updateDoc(hikeDocRef, updates);
  }

  return {
    hikeId,
    uploaded: {
      days: uploadedDays,
      images: uploadedImages,
    },
  };
}

/**
 * Utility - convert a gs:// path (or storage path) into a downloadURL (best-effort).
 * Returns undefined if resolution fails.
 */
export async function gsPathToDownloadUrl(gsPathOrPath?: string) {
  if (!gsPathOrPath) return undefined;
  try {
    const storage = getStorage();
    let path = gsPathOrPath;
    // normalize: strip gs://
    if (path.startsWith("gs://")) path = path.replace(/^gs:\/\//, "");
    const ref = storageRef(storage, path);
    const dl = await getDownloadURL(ref);
    return dl;
  } catch (e) {
    return undefined;
  }
}
