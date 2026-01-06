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
  DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AnyActionArg } from "react";

/**
 * Stronger typings for hike editor helpers
 */

export type DayEntry = {
  id: string;
  name?: string;
  // either inline geojson object or a "geojsonUrl" or "geojsonPath" (gs:// style)
  geojson?: unknown;
  geojsonUrl?: string; // http(s) url or download url
  geojsonPath?: string; // gs:// path or storage path
  stats?: unknown;
  color?: string | null;
  visible?: boolean;
};

export type ImageEntry = {
  path?: string; // gs:// path or storage path
  url?: string; // (optional) download url
  meta?: unknown;
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
 * _uploadToStorage
 * Uploads a Blob/File to firebase storage path (no leading gs://).
 * Returns gsPath and optionally downloadUrl.
 */
async function _uploadToStorage(
  file: File | Blob,
  destPath: string,
  returnDownloadUrl = false
): Promise<{ gsPath: string; downloadUrl?: string | undefined }> {
  const storage = getStorage();
  const ref = storageRef(storage, destPath);
  // uploadBytes may throw; bubble up
  await uploadBytes(ref, file as Blob);
  // Build gsPath; firebase StorageRef internals differ between SDKs so fall back safely
  const gsPath = `gs://${(ref as any)._location?.path ?? destPath}`;
  if (returnDownloadUrl) {
    try {
      const dl = await getDownloadURL(ref);
      return { gsPath, downloadUrl: dl };
    } catch (_err) {
      return { gsPath, downloadUrl: undefined };
    }
  }
  return { gsPath, downloadUrl: undefined };
}

/**
 * sanitizeForFirestore
 * Replace `undefined` values (which Firestore rejects) by omitting keys.
 * Accepts any input and returns a Firestore-friendly structure.
 */
function sanitizeForFirestore<T>(obj: T): unknown {
  if (typeof obj === "undefined") return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) return (obj as unknown[]).map((v) => sanitizeForFirestore(v));
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "undefined") {
        // omit undefined
        continue;
      }
      out[k] = sanitizeForFirestore(v);
    }
    return out;
  }
  // primitives (string, number, boolean)
  return obj;
}

/**
 * createHikeWithStorage
 * Creates a new hike doc under users/{ownerUid}/hikes/{generatedId}
 * Uploads inline day geojsons and image files if provided.
 */
export async function createHikeWithStorage(params: {
  title?: string;
  descriptionMd?: string;
  ownerUid?: string;
  dayTracks?: DayEntry[]; // can include inline geojson
  combinedGeojson?: unknown; // optional combined fc
  imageFiles?: File[]; // optional image files to upload
  visibility?: "private" | "public";
  storeDownloadUrls?: boolean;
}) {
  const {
    title,
    descriptionMd = "",
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
  const hikesColRef = collection(db, "users", uid, "hikes");
  const newDocRef = doc(hikesColRef);
  const hikeId = newDocRef.id;

  const uploadedDays: DayEntry[] = [];
  const uploadedImages: ImageEntry[] = [];

  // 1) upload any inline dayTracks (geojson objects)
  for (let i = 0; i < dayTracks.length; i++) {
    const d = dayTracks[i];
    if (typeof d.geojson !== "undefined" && d.geojson !== null) {
      const filename = `users/${uid}/hikes/${hikeId}/days/day-${Date.now()}-${i}.geojson`;
      const blob = new Blob([JSON.stringify(d.geojson)], { type: "application/json" });
      const uploaded = await _uploadToStorage(blob, filename, storeDownloadUrls);
      const entry: DayEntry = {
        id: d.id ?? `day-${Date.now()}-${i}`,
        name: d.name,
        geojsonPath: uploaded.gsPath,
        geojsonUrl: uploaded.downloadUrl,
        stats: typeof d.stats !== "undefined" ? d.stats : null,
        color: typeof d.color !== "undefined" ? d.color : null,
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
  if (typeof combinedGeojson !== "undefined" && combinedGeojson !== null) {
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
  const docPayload: Record<string, unknown> = {
    title: typeof title === "string" ? title : `Hike ${new Date().toISOString()}`,
    descriptionMd: typeof descriptionMd === "string" ? descriptionMd : "",
    owner: { uid },
    createdAt: serverTimestamp(),
    public: visibility === "public",
    days: uploadedDays.length ? uploadedDays : [],
    images: uploadedImages.length ? uploadedImages : [],
  };

  if (combinedPath) docPayload.combinedPath = combinedPath;
  if (combinedUrl) docPayload.combinedUrl = combinedUrl;

  // sanitize before sending to Firestore
  const payloadSafe = sanitizeForFirestore(docPayload) as Record<string, unknown>;
  await setDoc(newDocRef as DocumentReference<Record<string, unknown>>, payloadSafe);

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
 * Adds new days and images to an existing hike doc. Uploads inline geojsons and images then appends via arrayUnion.
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
  const hikeDocSnap = await getDoc(hikeDocRef);
  if (!hikeDocSnap.exists()) throw new Error("Hike doc not found");

  const uploadedDays: DayEntry[] = [];
  const uploadedImages: ImageEntry[] = [];

  // upload dayTracks (inline geojsons) and prepare entries
  for (let i = 0; i < dayTracks.length; i++) {
    const d = dayTracks[i];
    if (typeof d.geojson !== "undefined" && d.geojson !== null) {
      const filename = `users/${uid}/hikes/${hikeId}/days/day-${Date.now()}-${i}.geojson`;
      const blob = new Blob([JSON.stringify(d.geojson)], { type: "application/json" });
      const uploaded = await _uploadToStorage(blob, filename, storeDownloadUrls);
      uploadedDays.push({
        id: d.id ?? `day-${Date.now()}-${i}`,
        name: d.name,
        geojsonPath: uploaded.gsPath,
        geojsonUrl: uploaded.downloadUrl,
        stats: typeof d.stats !== "undefined" ? d.stats : null,
        color: typeof d.color !== "undefined" ? d.color : null,
        visible: typeof d.visible === "boolean" ? d.visible : true,
      });
    } else {
      // pass-through existing DayEntry
      uploadedDays.push(d);
    }
  }

  // debug/info logs (safe)
  // eslint-disable-next-line no-console
  console.log("appendToHikeWithStorage: upload uid:", uid);
  // eslint-disable-next-line no-console
  console.log("storage bucket:", getStorage().app.options?.storageBucket ?? "(none)");

  // upload images
  for (let i = 0; i < imageFiles.length; i++) {
    const f = imageFiles[i];
    const dest = `users/${uid}/hikes/${hikeId}/images/${Date.now()}-${i}-${f.name}`;
    // eslint-disable-next-line no-console
    console.log("attempted path:", dest);
    const uploaded = await _uploadToStorage(f, dest, storeDownloadUrls);
    uploadedImages.push({ path: uploaded.gsPath, url: uploaded.downloadUrl });
  }

  // update doc using arrayUnion (only keys that have content)
  const updates: Record<string, unknown> = {};
  if (uploadedDays.length) updates.days = arrayUnion(...(uploadedDays as unknown as object[]));
  if (uploadedImages.length) updates.images = arrayUnion(...(uploadedImages as unknown as object[]));

  if (Object.keys(updates).length) {
    await updateDoc(hikeDocRef, updates as any);
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
 * gsPathToDownloadUrl - convert gs://style path or storage path to a download URL (best-effort).
 */
export async function gsPathToDownloadUrl(gsPathOrPath?: string) {
  if (!gsPathOrPath) return undefined;
  try {
    const storage = getStorage();
    let path = gsPathOrPath;
    if (path.startsWith("gs://")) path = path.replace(/^gs:\/\//, "");
    const ref = storageRef(storage, path);
    const dl = await getDownloadURL(ref);
    return dl;
  } catch (_err) {
    return undefined;
  }
}
