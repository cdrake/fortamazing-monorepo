// src/hooks/fetchUserActivities.ts
import { getDocs, collection, query, orderBy } from "firebase/firestore"
import { getDownloadURL, getStorage, ref as storageRef } from "firebase/storage"
import { db } from "@/config/firebase"
import { app as firebaseApp } from "@/config/firebase"

export type MobileActivity = {
  id: string
  type?: string
  title?: string
  descriptionMd?: string
  createdAt?: any
  privacy?: string
  public?: boolean
  ownerUid?: string
  ownerUsername?: string | null
  days?: any[]
  images?: Array<{ path?: string; url?: string }>
  photos?: Array<{ path?: string; url?: string }>
  resolvedImageUrls?: string[]
  thumbnailUrl?: string | null
  raw?: any
}

async function gsPathToDownloadUrlWeb(gsPathOrPath?: string) {
  if (!gsPathOrPath) return undefined
  try {
    const storage = getStorage(firebaseApp)
    let path = gsPathOrPath
    if (path.startsWith("gs://")) path = path.replace(/^gs:\/\//, "")
    if (path.startsWith("/")) path = path.replace(/^\//, "")
    const ref = storageRef(storage, path)
    return await getDownloadURL(ref)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("gsPathToDownloadUrlWeb failed for", gsPathOrPath, err)
    return undefined
  }
}

/**
 * Fetch user activities once (not realtime). Returns MobileActivity[] with thumbnailUrl set.
 */
export async function fetchUserActivities(userUid: string, limitCount = 100): Promise<MobileActivity[]> {
  const activitiesRef = collection(db, "users", userUid, "activities")
  const q = query(activitiesRef, orderBy("createdAt", "desc"))
  const snap = await getDocs(q)

  const items = await Promise.all(
    snap.docs.map(async (docSnap) => {
      const data = docSnap.data() as any
      const images = Array.isArray(data.images) ? data.images : (Array.isArray(data.photos) ? data.photos : [])

      // Resolve each image to a usable URL
      const resolved = await Promise.all(
        images.map(async (img: any) => {
          if (!img) return undefined
          if (img.url && typeof img.url === "string") return img.url
          if (img.path && typeof img.path === "string") return await gsPathToDownloadUrlWeb(img.path)
          return undefined
        })
      )

      const presentUrls = resolved.filter(Boolean) as string[]
      const thumbnailUrl = presentUrls.length ? presentUrls[0] : null

      const item: MobileActivity = {
        id: docSnap.id,
        type: data.type ?? "hike",
        title: data.title ?? `Activity ${docSnap.id}`,
        descriptionMd: data.descriptionMd ?? data.description ?? "",
        createdAt: data.createdAt ?? null,
        privacy: data.privacy ?? (data.public ? "public" : "private"),
        public: data.public ?? false,
        ownerUid: data.ownerId ?? (data.owner && data.owner.uid) ?? userUid,
        ownerUsername: (data.owner && data.owner.username) ?? null,
        days: data.days ?? data.track?.days ?? [],
        images,
        photos: Array.isArray(data.photos) ? data.photos : images,
        resolvedImageUrls: presentUrls,
        thumbnailUrl,
        raw: data,
      }

      return item
    })
  )

  return items
}
