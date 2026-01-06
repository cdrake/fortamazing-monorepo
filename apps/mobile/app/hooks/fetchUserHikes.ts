// src/hooks/fetchUserHikes.ts
import { getDocs, collection, query, orderBy, DocumentData } from "firebase/firestore";
import { db } from "@/config/firebase";
import { gsPathToDownloadUrl } from "@/lib/hikeStorageHelpers";
import { getStorage } from "firebase/storage";
import type { FirebaseError } from "firebase/app";
import { auth as firebaseAuth } from "@/config/firebase";

/**
 * Hike shape returned to the app (lightweight)
 */
export type MobileHike = {
  id: string;
  title?: string;
  ownerUid?: string;
  ownerUsername?: string | undefined;
  public?: boolean;
  createdAt?: any;
  days?: any[];
  distance_m?: number | null;
  images?: Array<{ path?: string; url?: string; meta?: unknown }>;
  thumbnailUrl?: string | undefined;
  raw?: DocumentData;
};

/**
 * Type guard to narrow (MobileHike | null) to MobileHike
 */
function isMobileHike(v: MobileHike | null): v is MobileHike {
  return v !== null;
}

export async function fetchUserHikes(userUid: string): Promise<MobileHike[]> {
  if (!userUid) {
    console.warn("[fetchUserHikes] called with empty userUid");
    return [];
  }

  console.group(`[fetchUserHikes] start - userUid=${userUid}`);
  // debug: show firebase auth user at start (may be null)
  try {
    console.log("[fetchUserHikes] firebaseAuth.currentUser:", firebaseAuth?.currentUser?.uid ?? null);
  } catch (e) {
    console.warn("[fetchUserHikes] could not read firebaseAuth.currentUser", e);
  }
  // debug: configured storage bucket
  try {
    const configuredBucket = (getStorage() as any)?.app?.options?.storageBucket;
    console.log("[fetchUserHikes] storage bucket configured:", configuredBucket);
  } catch (e) {
    console.warn("[fetchUserHikes] could not read storage config", e);
  }

  const hikesColRef = collection(db, "users", userUid, "hikes");
  const q = query(hikesColRef, orderBy("createdAt", "desc"));
  console.log("[fetchUserHikes] query constructed:", { path: `users/${userUid}/hikes`, orderBy: "createdAt desc" });

  // helper: resolve image url but swallow any per-image errors
  async function safeResolveImage(img: any, docId: string, imgIdx: number): Promise<string | undefined> {
    try {
      if (!img) return undefined;
      if (typeof img.url === "string" && img.url.length > 0) {
        console.log(`[fetchUserHikes] doc ${docId} image[${imgIdx}] using stored url`);
        return img.url;
      }
      if (typeof img.path === "string" && img.path.length > 0) {
        console.log(`[fetchUserHikes] doc ${docId} image[${imgIdx}] resolving gs path`, img.path);
        const resolved = await gsPathToDownloadUrl(img.path);
        console.log(`[fetchUserHikes] doc ${docId} image[${imgIdx}] resolved ->`, resolved);
        return resolved;
      }
      if (typeof img === "string") {
        // image might be stored as just a raw string path/url
        if (img.startsWith("http")) return img;
        return await gsPathToDownloadUrl(img);
      }
      return undefined;
    } catch (e) {
      console.warn(`[fetchUserHikes] doc ${docId} image[${imgIdx}] resolution failed (non-fatal)`, e);
      return undefined;
    }
  }

  try {
    const snap = await getDocs(q);
    console.log(`[fetchUserHikes] snapshot received - docs: ${snap.size}`);

    const itemsMaybe = await Promise.all(
      snap.docs.map(async (d, idx) => {
        console.groupCollapsed(`[fetchUserHikes] processing doc ${idx} id=${d.id}`);
        let raw: Record<string, unknown> | null = null;
        try {
          raw = d.data() as Record<string, unknown> | null;
          console.log("raw keys:", raw ? Object.keys(raw) : raw);
        } catch (err) {
          console.error(`[fetchUserHikes] failed to read data() for doc ${d.id}`, err);
          console.groupEnd();
          return null;
        }
        if (!raw) {
          console.warn(`[fetchUserHikes] doc ${d.id} has no data -> skipping`);
          console.groupEnd();
          return null;
        }

        // days handling
        const days = Array.isArray(raw.days) ? (raw.days as unknown[]) : undefined;
        if (!days) {
          console.warn(`[fetchUserHikes] doc ${d.id} missing or invalid 'days' field - skipping (doc may be incomplete)`);
          console.groupEnd();
          return null;
        }

        // compute total distance
        let totalDistance: number | null = null;
        try {
          const sum = (days || []).reduce((acc: number, day: unknown) => {
            if (day && typeof day === "object") {
              const stat = (day as Record<string, unknown>).stats as Record<string, unknown> | undefined;
              const v = stat && typeof stat.distance_m === "number" ? (stat.distance_m as number) : 0;
              return acc + v;
            }
            return acc;
          }, 0);
          totalDistance = sum > 0 ? sum : null;
          console.log(`[fetchUserHikes] doc ${d.id} totalDistance=${totalDistance}`);
        } catch (err) {
          console.error(`[fetchUserHikes] error computing totalDistance for doc ${d.id}`, err);
          totalDistance = null;
        }

        // resolve images (prefer url, otherwise attempt to convert gs:// or path)
        const imagesRaw = Array.isArray(raw.images) ? (raw.images as any[]) : [];
        const resolvedImageUrls = await Promise.all(
          imagesRaw.map((img: any, imgIdx: number) => safeResolveImage(img, d.id, imgIdx))
        );

        const firstThumb = resolvedImageUrls.find(Boolean) as string | undefined;
        const owner = raw.owner as Record<string, unknown> | undefined;

        const result: MobileHike = {
          id: d.id,
          title: typeof raw.title === "string" ? raw.title : undefined,
          ownerUid: userUid,
          ownerUsername: (owner?.displayName as unknown as string) ?? (owner?.email as unknown as string) ?? undefined,
          public: !!raw.public,
          createdAt: raw.createdAt,
          days,
          distance_m: totalDistance,
          images: imagesRaw,
          thumbnailUrl: firstThumb,
          raw,
        };

        console.log(`[fetchUserHikes] doc ${d.id} -> assembled MobileHike`, {
          id: result.id,
          title: result.title,
          thumbnail: result.thumbnailUrl,
          distance_m: result.distance_m,
        });

        console.groupEnd();
        return result;
      })
    );

    const items = itemsMaybe.filter(isMobileHike);
    console.log(`[fetchUserHikes] returning ${items.length} items`);
    console.groupEnd();
    return items;
  } catch (err) {
    const maybeFirebaseErr = err as FirebaseError | Error;
    console.error("[fetchUserHikes] top-level error while fetching hikes:", {
      name: maybeFirebaseErr.name,
      message: maybeFirebaseErr.message,
      code: (maybeFirebaseErr as any).code,
      stack: maybeFirebaseErr.stack,
    });
    console.groupEnd();
    // rethrow so caller can set UI error state (keeps behavior consistent)
    throw err;
  }
}
