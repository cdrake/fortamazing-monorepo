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
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { GearItem, GearCategory } from "@fortamazing/lib";

export type { GearItem, GearCategory };

function gearCollectionFor(uid: string) {
  return collection(db, "users", uid, "gear");
}

export async function listGear(uid: string): Promise<(GearItem & { id: string })[]> {
  const colRef = gearCollectionFor(uid);
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GearItem & { id: string }));
}

export async function getGearItem(uid: string, gearId: string): Promise<(GearItem & { id: string }) | null> {
  const docRef = doc(db, "users", uid, "gear", gearId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as GearItem & { id: string };
}

export async function createGearItem(
  data: Omit<GearItem, "createdAt" | "updatedAt">
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Must be signed in");
  const uid = data.ownerId || user.uid;
  const now = new Date().toISOString();
  const docRef = await addDoc(gearCollectionFor(uid), {
    ...data,
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateGearItem(
  uid: string,
  gearId: string,
  data: Partial<GearItem>
): Promise<void> {
  const docRef = doc(db, "users", uid, "gear", gearId);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteGearItem(uid: string, gearId: string): Promise<void> {
  const docRef = doc(db, "users", uid, "gear", gearId);
  await deleteDoc(docRef);
}

export function totalWeight(items: GearItem[]): number {
  return items.reduce((sum, item) => sum + (item.weight ?? 0), 0);
}
