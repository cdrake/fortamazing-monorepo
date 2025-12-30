"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  orderBy,
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
  distance_m?: number | null;
};

export default function HikesPage() {
  const [loading, setLoading] = useState(false);
  const [hikes, setHikes] = useState<HikeDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // ref that will be filled by TrackUploader via registerLoad
  const uploaderLoadRef = useRef<((hikeId: string) => Promise<void>) | null>(null);

  // register function passed to TrackUploader
  const registerUploaderLoad = useCallback((fn: (hikeId: string) => Promise<void>) => {
    uploaderLoadRef.current = fn;
    // return a cleanup/unregister function if caller wants to support it (not required)
    return () => {
      if (uploaderLoadRef.current === fn) uploaderLoadRef.current = null;
    };
  }, []);

  // load hikes for the currently-signed-in user from users/{uid}/hikes
  const loadUserHikes = useCallback(async (user: User) => {
    setLoading(true);
    setError(null);
    try {
      const hikesColRef = collection(db, "users", user.uid, "hikes");
      const q = query(hikesColRef, orderBy("createdAt", "desc"));
      const snap: QuerySnapshot<DocumentData> = await getDocs(q);

      const items: HikeDoc[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          // Only include docs created by the uploader helper (it writes a `days` array)
          if (!data || !Array.isArray(data.days)) return null;

          // compute total distance if days[].stats.distance_m exist (sum)
          let totalDistance: number | null = null;
          try {
            const sum = (data.days || []).reduce((acc: number, day: any) => {
              const v = day?.stats?.distance_m;
              return acc + (typeof v === "number" ? v : 0);
            }, 0);
            totalDistance = sum > 0 ? sum : null;
          } catch (e) {
            totalDistance = null;
          }

          return {
            id: d.id,
            title: data.title,
            ownerUid: user.uid,
            ownerUsername: data.owner?.displayName ?? data.owner?.email ?? undefined,
            public: !!data.public,
            createdAt: data.createdAt,
            days: data.days,
            distance_m: totalDistance,
          } as HikeDoc;
        })
        .filter(Boolean) as HikeDoc[];

      setHikes(items);
    } catch (err: any) {
      console.error("Error loading user hikes:", err);
      setError(String(err?.message ?? err));
      setHikes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // load hikes for this user (these are the docs created by saveAllWithStorage)
        loadUserHikes(user);
      } else {
        // signed out: clear list
        setHikes([]);
      }
    });

    return () => unsub();
  }, [loadUserHikes]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">My Hikes</h1>

      <div className="mb-6">
        {/* Pass registerLoad so the page can ask the uploader to load a saved hike into the preview */}
        <TrackUploader registerLoad={registerUploaderLoad} />
      </div>

      <div className="mb-4">
        {currentUser ? (
          <div className="text-sm text-gray-700">Signed in as {currentUser.displayName ?? currentUser.email}</div>
        ) : (
          <div className="text-sm text-gray-700">Not signed in — sign in to see your uploaded hikes.</div>
        )}
      </div>

      <div className="mb-4">
        <button
          className="px-3 py-1 border rounded mr-2"
          onClick={() => {
            const user = getAuth().currentUser;
            if (user) loadUserHikes(user);
            else setError("Sign in to refresh your hikes");
          }}
          disabled={!currentUser || loading}
        >
          Refresh my hikes
        </button>
      </div>

      {loading && <p>Loading your hikes…</p>}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && currentUser && hikes.length === 0 && (
        <div className="mb-4 text-gray-600">You have no hikes saved with the uploader yet.</div>
      )}

      {!currentUser && (
        <div className="mb-4 text-gray-600">Sign in to view hikes created by the uploader (stored under users/uid/hikes).</div>
      )}

      <ul className="space-y-3 mt-4">
        {hikes.map((h) => (
          <li key={`${h.ownerUid ?? "u"}_${h.id}`} className="p-3 border rounded">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-semibold">{h.title || "Untitled hike"}</div>
                <div className="text-sm text-gray-600">by {h.ownerUsername || h.ownerUid || "you"}</div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-sm text-gray-500">{h.public ? "Public" : "Private"}</div>

                {/* Load button: asks the uploader to load this hike into its preview map */}
                <div>
                  <button
                    className="px-2 py-1 border rounded text-sm"
                    onClick={async () => {
                      const authUser = getAuth().currentUser;
                      if (!authUser) {
                        alert("Please sign in to load this hike into the preview.");
                        return;
                      }
                      if (!uploaderLoadRef.current) {
                        alert("Uploader not ready yet. Try again in a moment.");
                        return;
                      }
                      try {
                        await uploaderLoadRef.current(h.id);
                      } catch (err) {
                        console.error("Failed to load hike into uploader:", err);
                        alert("Failed to load hike — check console for details.");
                      }
                    }}
                  >
                    Load
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 text-sm text-gray-600">
              {h.createdAt ? (
                <span>
                  {typeof h.createdAt?.toDate === "function"
                    ? h.createdAt.toDate().toLocaleString()
                    : new Date(h.createdAt).toLocaleString()}
                </span>
              ) : (
                <span>—</span>
              )}
              {h.distance_m ? <span> • {(h.distance_m / 1000).toFixed(2)} km</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
