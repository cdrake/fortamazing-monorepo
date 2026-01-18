// src/lib/hikes.ts
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/config/firebase";

export type Hike = {
  id?: string;
  title?: string;
  owner?: any; // could be uid string or owner object { uid, displayName, email }
  createdAt?: any;
  description?: string;
  bounds?: { north: number; south: number; east: number; west: number } | null;
  // add other fields your web app uses
};

/**
 * Helper to get the collection ref for users/{uid}/hikes
 * ownerUid optional -> fall back to current signed-in user
 */
function hikesCollectionFor(ownerUid?: string) {
  const uid = ownerUid ?? (auth?.currentUser?.uid ?? null);
  if (!uid) {
    throw new Error("ownerUid not supplied and no authenticated user available");
  }
  return collection(db, "users", uid, "hikes");
}

/**
 * listHikes(ownerUid?)
 * If ownerUid is supplied, list that user's hikes; otherwise fall back to currently signed-in user.
 * NOTE: this mirrors the paths used by the rest of the app and your security rules.
 */
export async function listHikes(ownerUid?: string): Promise<Hike[]> {
  const col = hikesCollectionFor(ownerUid);
  const q = query(col, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Hike) }));
}

/**
 * getHike(hikeId, ownerUid?)
 * Fetch a single hike from users/{ownerUid}/hikes/{hikeId}.
 * ownerUid optional -> try owner in current user if omitted.
 */
export async function getHike(hikeId: string, ownerUid?: string): Promise<Hike | null> {
  if (!hikeId) throw new Error("hikeId required");
  const uid = ownerUid ?? (auth?.currentUser?.uid ?? null);
  if (!uid) throw new Error("ownerUid not supplied and no authenticated user available");
  const ref = doc(db, "users", uid, "hikes", hikeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Hike) };
}

/**
 * createHike
 * Create a hike under users/{ownerUid}/hikes.
 */
export async function createHike(payload: Partial<Hike> & { owner: string; ownerUid?: string }) {
  const ownerUid = payload.ownerUid ?? payload.owner ?? (auth?.currentUser?.uid ?? null);
  if (!ownerUid) throw new Error("ownerUid must be provided or user must be signed in");
  const ref = await addDoc(collection(db, "users", ownerUid, "hikes"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
