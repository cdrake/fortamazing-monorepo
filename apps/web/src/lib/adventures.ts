"use client";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { Adventure, AdventureStatus, PackingListItem } from "@fortamazing/lib/types";

export type { Adventure, AdventureStatus, PackingListItem };

function adventuresCollectionFor(uid: string) {
  return collection(db, "users", uid, "adventures");
}

export async function listAdventures(uid: string): Promise<(Adventure & { id: string })[]> {
  const colRef = adventuresCollectionFor(uid);
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Adventure & { id: string }));
}

export async function getAdventure(uid: string, adventureId: string): Promise<(Adventure & { id: string }) | null> {
  const docRef = doc(db, "users", uid, "adventures", adventureId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Adventure & { id: string };
}

export async function createAdventure(
  data: Omit<Adventure, "createdAt" | "updatedAt">
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Must be signed in");
  const uid = data.ownerId || user.uid;
  const now = new Date().toISOString();
  const docRef = await addDoc(adventuresCollectionFor(uid), {
    ...data,
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateAdventure(
  uid: string,
  adventureId: string,
  data: Partial<Adventure>
): Promise<void> {
  const docRef = doc(db, "users", uid, "adventures", adventureId);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteAdventure(uid: string, adventureId: string): Promise<void> {
  const docRef = doc(db, "users", uid, "adventures", adventureId);
  await deleteDoc(docRef);
}

/**
 * Fetch activities linked to an adventure
 */
export async function listActivitiesForAdventure(uid: string, adventureId: string) {
  const activitiesRef = collection(db, "users", uid, "activities");
  const q = query(activitiesRef, where("adventureId", "==", adventureId), orderBy("startTime", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
