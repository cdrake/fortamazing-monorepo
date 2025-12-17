"use client";
import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  collectionGroup,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import TrackUploader from "./components/TrackUploader";

type HikeDoc = {
  id: string;
  title?: string;
  ownerUid?: string;
  ownerUsername?: string;
  public?: boolean;
  createdAt?: any;
  days?: any[];
  // add any other fields you store
};

export default function HikesPage() {
  const [loading, setLoading] = useState(true);
  const [hikes, setHikes] = useState<HikeDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getAuth();
    // listen for auth state changes — this lets us show owner controls later
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    // fetch public hikes immediately (doesn't require user)
    fetchPublicHikes().catch((e) => {
      console.error("Failed to load hikes", e);
      setError(String(e));
    });

    return () => unsub();
  }, []);

  async function fetchPublicHikes() {
    setLoading(true);
    setError(null);
    try {
      // Use collectionGroup to list all subcollections named "hikes" across users
      // NOTE: the client query *must* include where("public","==",true) so rules can validate it
      const hikesQ = query(
        collectionGroup(db, "hikes"),
        where("public", "==", true),
        // optional ordering; if you use createdAt make sure it's indexed for collectionGroup queries
        orderBy("createdAt", "desc"),
        limit(200)
      );

      const snap: QuerySnapshot<DocumentData> = await getDocs(hikesQ);

      const results: HikeDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as object),
      })) as HikeDoc[];

      setHikes(results);
    } catch (err: any) {
      // Provide a friendly message if it's a rules/permission error
      console.log("Error fetching hikes:", err);
      if (err?.code === "permission-denied" || /permission/i.test(String(err))) {
        setError("Permission denied while fetching hikes. Check Firestore rules and that the query includes public==true.");
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Hikes</h1>

      <TrackUploader />

      {loading && <p>Loading hikes…</p>}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && hikes.length === 0 && <p>No public hikes found.</p>}

      <ul className="space-y-3 mt-4">
        {hikes.map((h) => (
          <li key={h.id} className="p-3 border rounded">
            <div className="flex justify-between">
              <div>
                <div className="text-lg font-semibold">{h.title || "Untitled hike"}</div>
                <div className="text-sm text-gray-600">by {h.ownerUsername || "unknown"}</div>
              </div>
              <div className="text-sm text-gray-500">{h.public ? "Public" : "Private"}</div>
            </div>
            {/* Add more fields or a link to view the hike */}
          </li>
        ))}
      </ul>
    </div>
  );
}
