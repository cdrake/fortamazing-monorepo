// src/hooks/fetchUserHikes.ts
import { getDocs, collection, query, orderBy } from "firebase/firestore";
import { getDownloadURL, getStorage, ref as storageRef } from "firebase/storage";
import { db } from "@/config/firebase"; // keep your existing exports
import { app as firebaseApp } from "@/config/firebase"; // ensure this is exported from your config

export type MobileHike = {
  id: string;
  title?: string;
  descriptionMd?: string;
  createdAt?: any;
  public?: boolean;
  ownerUid?: string;
  ownerUsername?: string | null;
  days?: any[];
  images?: Array<{ path?: string; url?: string }>;
  resolvedImageUrls?: string[];
  thumbnailUrl?: string | null;
  raw?: any;
};

async function gsPathToDownloadUrlWeb(gsPathOrPath?: string) {
  if (!gsPathOrPath) return undefined;
  try {
    const storage = getStorage(firebaseApp);
    let path = gsPathOrPath;
    if (path.startsWith("gs://")) path = path.replace(/^gs:\/\//, "");
    if (path.startsWith("/")) path = path.replace(/^\//, "");
    const ref = storageRef(storage, path);
    return await getDownloadURL(ref);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("gsPathToDownloadUrlWeb failed for", gsPathOrPath, err);
    return undefined;
  }
}

/**
 * Fetch user hikes once (not realtime). Returns MobileHike[] with thumbnailUrl set.
 */
export async function fetchUserHikes(userUid: string, limitCount = 100): Promise<MobileHike[]> {
  const hikesRef = collection(db, "users", userUid, "hikes");
  const q = query(hikesRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  const items = await Promise.all(
    snap.docs.map(async (docSnap) => {
      const data = docSnap.data() as any;
      const images = Array.isArray(data.images) ? data.images : [];

      // Resolve each image to a usable URL
      const resolved = await Promise.all(
        images.map(async (img: any) => {
          if (!img) return undefined;
          if (img.url && typeof img.url === "string") return img.url;
          if (img.path && typeof img.path === "string") return await gsPathToDownloadUrlWeb(img.path);
          return undefined;
        })
      );

      const presentUrls = resolved.filter(Boolean) as string[];
      const thumbnailUrl = presentUrls.length ? presentUrls[0] : null;

      const item: MobileHike = {
        id: docSnap.id,
        title: data.title ?? `Hike ${docSnap.id}`,
        descriptionMd: data.descriptionMd ?? "",
        createdAt: data.createdAt ?? null,
        public: data.public ?? false,
        ownerUid: (data.owner && data.owner.uid) ?? userUid,
        ownerUsername: (data.owner && data.owner.username) ?? null,
        days: data.days ?? [],
        images,
        resolvedImageUrls: presentUrls,
        thumbnailUrl,
        raw: data,
      };

      // debug
      // eslint-disable-next-line no-console
      console.debug("[fetchUserHikes] resolved", item.id, { resolvedImageUrls: presentUrls, thumbnailUrl });

      return item;
    })
  );

  return items;
}
