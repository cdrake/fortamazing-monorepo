// src/hooks/useUserHikes.ts
import { useEffect, useState } from "react";
import { doc, collection, query, orderBy, onSnapshot, QuerySnapshot, DocumentData } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { getDownloadURL, getStorage, ref as storageRef } from "firebase/storage";
import { app as firebaseApp } from "@/config/firebase";
import { resolveStoragePathToDownloadUrl } from "@/lib/images";
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
  thumbnailUrl?: string | null;
  raw?: any;
};

export function useUserHikes(limitCount = 100) {
  const [hikes, setHikes] = useState<HikeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

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
                  if (img.path && typeof img.path === "string") {
                    // use the local web/native helper defined above
                    return await resolveStoragePathToDownloadUrl(img.path);
                  }
                  return undefined;
                })
              );

              console.log("[useUserHikes] resolvedImageUrls for hike", docSnap.id, resolvedImageUrls);

              const presentUrls = resolvedImageUrls.filter(Boolean) as string[];
              const thumbnailUrl = presentUrls.length > 0 ? presentUrls[0] : null;

              const item: HikeItem = {
                id: docSnap.id,
                title: data.title ?? `Hike ${docSnap.id}`,
                descriptionMd: data.descriptionMd ?? "",
                createdAt: data.createdAt ?? null,
                public: data.public ?? false,
                ownerUid: (data.owner && data.owner.uid) ?? user.uid,
                days: data.days ?? [],
                images,
                resolvedImageUrls: presentUrls,
                thumbnailUrl,
                raw: data,
              };

              // quick debug log so you can see the resolved urls in console
              // eslint-disable-next-line no-console
              console.debug("[useUserHikes] resolved", item.id, { resolvedImageUrls: presentUrls, thumbnailUrl });

              return item;
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
