// src/hooks/useUserHikes.ts
import { useEffect, useState } from "react";
import { doc, collection, query, orderBy, onSnapshot, QuerySnapshot, DocumentData } from "firebase/firestore";
import { db, auth } from "../config/firebase"; // <- import auth from your firebase module
import { gsPathToDownloadUrl } from "@/lib/hikeStorageHelpers";
import { getDownloadURL, getStorage, ref as storageRef, } from "firebase/storage";
import { app as firebaseApp } from "@/config/firebase";

export type HikeItem = {
  id: string;
  title: string;
  descriptionMd?: string;
  createdAt?: any;
  public?: boolean;
  ownerUid?: string;
  days?: any[];
  images?: Array<{ path?: string; url?: string }>;
  resolvedImageUrls?: string[];
  raw?: any;
};

// helper for web (you can also reuse your server helper)
async function gsPathToDownloadUrlWeb(gsPathOrPath?: string) {
  if (!gsPathOrPath) return undefined;
  try {
    const storage = getStorage(firebaseApp);
    let path = gsPathOrPath;
    if (path.startsWith("gs://")) path = path.replace(/^gs:\/\//, "");
    const ref = storageRef(storage, path);
    const dl = await getDownloadURL(ref);
    return dl;
  } catch (err) {
    // don't throw — return undefined and let caller handle missing image
    // eslint-disable-next-line no-console
    console.warn("gsPathToDownloadUrlWeb failed for", gsPathOrPath, err);
    return undefined;
  }
}

export function useUserHikes(limitCount = 100) {
  const [hikes, setHikes] = useState<HikeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Use the exported auth instance (avoids initializeApp race)
    const user = auth?.currentUser;
    if (!user) {
      setHikes([]);
      setLoading(false);
      setError("Not signed in");
      return;
    }

    const hikesRef = collection(db, "users", user.uid, "hikes");
    const q = query(hikesRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      async (snap: QuerySnapshot<DocumentData>) => {
        try {
          const items = await Promise.all(
            snap.docs.map(async (docSnap) => {
              const data = docSnap.data() as any;
              const images = Array.isArray(data.images) ? data.images : [];
              const resolvedImageUrls = await Promise.all(
                images.map(async (img: any) => {
                  if (!img) return null;
                  if (img.url && typeof img.url === "string") return img.url;
                  if (img.path && typeof img.path === "string") return await gsPathToDownloadUrl(img.path);
                  return undefined;
                })
              );

              return {
                id: docSnap.id,
                title: data.title ?? `Hike ${docSnap.id}`,
                descriptionMd: data.descriptionMd ?? "",
                createdAt: data.createdAt ?? null,
                public: data.public ?? false,
                ownerUid: (data.owner && data.owner.uid) ?? user.uid,
                days: data.days ?? [],
                images,
                resolvedImageUrls: resolvedImageUrls.filter(Boolean) as string[],
                raw: data,
              } as HikeItem;
            })
          );

          setHikes(items);
          setLoading(false);
        } catch (e: any) {
          console.warn("useUserHikes mapping error", e);
          setError(String(e));
          setLoading(false);
        }
      },
      (err) => {
        console.warn("useUserHikes onSnapshot error", err);
        setError(String(err));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [limitCount]);

  return { hikes, loading, error };
}
