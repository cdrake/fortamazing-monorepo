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
import TrackDetail from "./components/TrackDetail";

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

  // uploader modal state
  const [uploaderOpen, setUploaderOpen] = useState(false);

  // detail modal state
  const [detailOpen, setDetailOpen] = useState(false);

  // refs for load handlers exposed by child components
  const uploaderLoadRef = useRef<((hikeId: string) => Promise<void>) | null>(null);
  const detailLoadRef = useRef<((hikeId: string) => Promise<void>) | null>(null);

  // register functions passed to children
  const registerUploaderLoad = useCallback((fn: (hikeId: string) => Promise<void>) => {
    uploaderLoadRef.current = fn;
    return () => {
      if (uploaderLoadRef.current === fn) uploaderLoadRef.current = null;
    };
  }, []);

  const registerDetailLoad = useCallback((fn: (hikeId: string) => Promise<void>) => {
    detailLoadRef.current = fn;
    return () => {
      if (detailLoadRef.current === fn) detailLoadRef.current = null;
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
          if (!data || !Array.isArray(data.days)) return null;

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
        loadUserHikes(user);
      } else {
        setHikes([]);
      }
    });
    return () => unsub();
  }, [loadUserHikes]);

  // open uploader modal (for new upload)
  const openUploader = useCallback(() => {
    setUploaderOpen(true);
  }, []);

  // open detail modal and ask the TrackDetail child to load the hikeId
  const openDetailAndLoad = useCallback(async (hikeId: string) => {
    setDetailOpen(true);

    // Poll for the detail's load handler to register (short timeout)
    const start = Date.now();
    const timeoutMs = 3000;
    const intervalMs = 80;

    while (Date.now() - start < timeoutMs) {
      if (detailLoadRef.current) {
        try {
          await detailLoadRef.current(hikeId);
        } catch (err) {
          console.error("Error calling TrackDetail load handler:", err);
          // show friendly message
          alert("Failed to load the hike in detail view — check console for details.");
        }
        return;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, intervalMs));
    }

    // timed out waiting for child to register
    console.warn("Timed out waiting for TrackDetail to register load handler");
    alert("Detail view not ready yet. Try again in a moment.");
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">My Hikes</h1>

      <div className="mb-6 flex items-center gap-3">
        <button
          className="px-3 py-1 border rounded bg-white"
          onClick={openUploader}
        >
          New Upload
        </button>

        <button
          className="px-3 py-1 border rounded"
          onClick={() => {
            const user = getAuth().currentUser;
            if (user) loadUserHikes(user);
            else setError("Sign in to refresh your hikes");
          }}
          disabled={!currentUser}
        >
          Refresh my hikes
        </button>

        {currentUser ? (
          <div className="text-sm text-gray-700 ml-auto">Signed in as {currentUser.displayName ?? currentUser.email}</div>
        ) : (
          <div className="text-sm text-gray-700 ml-auto">Not signed in — sign in to see your uploaded hikes.</div>
        )}
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

                <div>
                  <button
                    className="px-2 py-1 border rounded text-sm"
                    onClick={async () => {
                      const authUser = getAuth().currentUser;
                      if (!authUser) {
                        alert("Please sign in to view this hike.");
                        return;
                      }
                      await openDetailAndLoad(h.id);
                    }}
                  >
                    View
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

      {/* TrackDetail modal (read-only view) */}
      {detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start md:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Track detail"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailOpen(false)} />

          <div className="relative w-full max-w-6xl bg-white rounded-t-xl md:rounded-xl shadow-lg p-4 m-4 overflow-auto" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Track detail</h2>
              <button className="px-2 py-1 border rounded" onClick={() => setDetailOpen(false)} aria-label="Close detail">Close</button>
            </div>

            <div>
              {/* Pass registerLoad so TrackDetail can expose a load(hikeId) function to this page */}
              <TrackDetail registerLoad={registerDetailLoad} />
            </div>
          </div>
        </div>
      )}

      {/* TrackUploader modal */}
      {uploaderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start md:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Track uploader"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setUploaderOpen(false)} />

          <div className="relative w-full max-w-6xl bg-white rounded-t-xl md:rounded-xl shadow-lg p-4 m-4 overflow-auto" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Track uploader</h2>
              <button className="px-2 py-1 border rounded" onClick={() => setUploaderOpen(false)} aria-label="Close uploader">Close</button>
            </div>

            <div>
              <TrackUploader registerLoad={registerUploaderLoad} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
