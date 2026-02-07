// src/hooks/useUserActivities.ts
import { useEffect, useState } from "react"
import { collection, query, orderBy, onSnapshot, QuerySnapshot, DocumentData } from "firebase/firestore"
import { db, auth } from "../config/firebase"
import { resolveStoragePathToDownloadUrl } from "@/lib/images"

export type ActivityItem = {
  id: string
  type?: string
  title: string
  descriptionMd?: string
  createdAt?: any
  privacy?: string
  public?: boolean
  ownerUid?: string
  days?: any[]
  images?: Array<{ path?: string; url?: string }>
  photos?: Array<{ path?: string; url?: string }>
  resolvedImageUrls?: string[]
  thumbnailUrl?: string | null
  raw?: any
}

export function useUserActivities(limitCount = 100) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const user = auth?.currentUser
    if (!user) {
      setActivities([])
      setLoading(false)
      setError("Not signed in")
      return
    }

    const activitiesRef = collection(db, "users", user.uid, "activities")
    const q = query(activitiesRef, orderBy("createdAt", "desc"))

    const unsub = onSnapshot(
      q,
      async (snap: QuerySnapshot<DocumentData>) => {
        try {
          const items = await Promise.all(
            snap.docs.map(async (docSnap) => {
              const data = docSnap.data() as any
              const images = Array.isArray(data.images)
                ? data.images
                : Array.isArray(data.photos)
                  ? data.photos
                  : []

              const resolvedImageUrls = await Promise.all(
                images.map(async (img: any) => {
                  if (!img) return null
                  if (img.url && typeof img.url === "string") return img.url
                  if (img.path && typeof img.path === "string") {
                    return await resolveStoragePathToDownloadUrl(img.path)
                  }
                  return undefined
                }),
              )

              const presentUrls = resolvedImageUrls.filter(Boolean) as string[]
              const thumbnailUrl = presentUrls.length > 0 ? presentUrls[0] : null

              const item: ActivityItem = {
                id: docSnap.id,
                type: data.type ?? "hike",
                title: data.title ?? `Activity ${docSnap.id}`,
                descriptionMd: data.descriptionMd ?? data.description ?? "",
                createdAt: data.createdAt ?? null,
                privacy: data.privacy ?? (data.public ? "public" : "private"),
                public: data.public ?? false,
                ownerUid: data.ownerId ?? (data.owner && data.owner.uid) ?? user.uid,
                days: data.days ?? data.track?.days ?? [],
                images,
                photos: Array.isArray(data.photos) ? data.photos : images,
                resolvedImageUrls: presentUrls,
                thumbnailUrl,
                raw: data,
              }

              return item
            }),
          )

          setActivities(items)
          setLoading(false)
        } catch (e: any) {
          console.warn("useUserActivities mapping error", e)
          setError(String(e))
          setLoading(false)
        }
      },
      (err) => {
        console.warn("useUserActivities onSnapshot error", err)
        setError(String(err))
        setLoading(false)
      },
    )

    return () => unsub()
  }, [limitCount])

  return { activities, loading, error }
}
