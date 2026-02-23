// src/lib/activities.ts
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore"
import { db, auth } from "@/config/firebase"

export type Activity = {
  id?: string
  ownerId?: string
  type?: string
  title?: string
  description?: string
  descriptionMd?: string
  owner?: any
  createdAt?: any
  updatedAt?: any
  privacy?: string
  public?: boolean
  bounds?: { north: number; south: number; east: number; west: number } | null
  days?: any[]
  images?: any[]
  photos?: any[]
  track?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Helper to get the collection ref for users/{uid}/activities
 */
function activitiesCollectionFor(ownerUid?: string) {
  const uid = ownerUid ?? (auth?.currentUser?.uid ?? null)
  if (!uid) {
    throw new Error("ownerUid not supplied and no authenticated user available")
  }
  return collection(db, "users", uid, "activities")
}

/**
 * listActivities(ownerUid?)
 */
export async function listActivities(ownerUid?: string): Promise<Activity[]> {
  const col = activitiesCollectionFor(ownerUid)
  const q = query(col, orderBy("createdAt", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Activity) }))
}

/**
 * getActivity(activityId, ownerUid?)
 */
export async function getActivity(activityId: string, ownerUid?: string): Promise<Activity | null> {
  if (!activityId) throw new Error("activityId required")
  const uid = ownerUid ?? (auth?.currentUser?.uid ?? null)
  if (!uid) throw new Error("ownerUid not supplied and no authenticated user available")
  const ref = doc(db, "users", uid, "activities", activityId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Activity) }
}

/**
 * createActivity
 */
export async function createActivity(payload: Partial<Activity> & { ownerId?: string; ownerUid?: string }) {
  const ownerUid = payload.ownerUid ?? payload.ownerId ?? (auth?.currentUser?.uid ?? null)
  if (!ownerUid) throw new Error("ownerUid must be provided or user must be signed in")
  const ref = await addDoc(collection(db, "users", ownerUid, "activities"), {
    ...payload,
    ownerId: ownerUid,
    type: payload.type ?? "hike",
    privacy: payload.privacy ?? "private",
    createdAt: serverTimestamp(),
    updatedAt: new Date().toISOString(),
  })
  return ref.id
}
