"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { getAuth, onAuthStateChanged, type User } from "firebase/auth"
import { getAdventure, updateAdventure, listActivitiesForAdventure } from "@/lib/adventures"
import { listGear } from "@/lib/gear"
import type { Adventure, PackingListItem } from "@fortamazing/lib"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import PackingList from "../components/PackingList"
import StoryTab from "../components/StoryTab"
import TrainingTab from "../components/TrainingTab"
import JournalTab from "../components/JournalTab"
import Link from "next/link"
import { fetchMealsForDateRange, type DietRangeSummary } from "../lib/dietFetcher"

export default function AdventureDetailPage() {
  const params = useParams()
  const adventureId = params?.id as string

  const [user, setUser] = useState<User | null>(null)
  const [adventure, setAdventure] = useState<(Adventure & { id: string }) | null>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [gearItems, setGearItems] = useState<{ id: string; name: string; category?: string; weight?: number }[]>([])
  const [dietSummary, setDietSummary] = useState<DietRangeSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (uid: string) => {
    setLoading(true)
    try {
      const [adv, acts, gear] = await Promise.all([
        getAdventure(uid, adventureId),
        listActivitiesForAdventure(uid, adventureId),
        listGear(uid),
      ])
      setAdventure(adv)
      setActivities(acts)
      setGearItems(gear.map((g) => ({ id: g.id, name: g.name, category: g.category, weight: g.weight })))

      // Fetch diet summary based on activity date range
      if (acts.length > 0) {
        const times = acts
          .map((a: any) => a.startTime)
          .filter(Boolean)
          .map((t: string) => new Date(t).getTime())
        const endTimes = acts
          .map((a: any) => a.endTime ?? a.startTime)
          .filter(Boolean)
          .map((t: string) => new Date(t).getTime())

        if (times.length > 0 && endTimes.length > 0) {
          const start = new Date(Math.min(...times))
          const end = new Date(Math.max(...endTimes))
          fetchMealsForDateRange(uid, start, end)
            .then(setDietSummary)
            .catch(() => setDietSummary(null))
        }
      }
    } catch (err) {
      console.error("Error loading adventure:", err)
    } finally {
      setLoading(false)
    }
  }, [adventureId])

  useEffect(() => {
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) void load(u.uid)
      else setLoading(false)
    })
    return () => unsub()
  }, [load])

  const handlePackingListChange = async (items: PackingListItem[]) => {
    if (!user || !adventure) return
    setAdventure({ ...adventure, packingList: items })
    await updateAdventure(user.uid, adventureId, { packingList: items })
  }

  if (loading) return <p className="p-4">Loading...</p>
  if (!adventure) return <p className="p-4">Adventure not found.</p>

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <Link href="/adventures" className="text-blue-500 hover:underline text-sm">
        &larr; Back to Adventures
      </Link>

      <h1 className="text-2xl font-bold mt-2 mb-1">{adventure.title}</h1>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">
          {adventure.status.replace("_", " ")} &middot; {adventure.privacy}
        </span>
        {adventure.targetDate && (
          <span className="text-sm text-gray-400">Target: {adventure.targetDate}</span>
        )}
      </div>

      {adventure.description && (
        <p className="text-gray-600 mb-6">{adventure.description}</p>
      )}

      <Tabs defaultValue="story" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="story">Story</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="packing">Packing List</TabsTrigger>
        </TabsList>

        <TabsContent value="story">
          <StoryTab
            adventure={adventure}
            activities={activities}
            dietSummary={dietSummary}
          />
        </TabsContent>

        <TabsContent value="training">
          <TrainingTab activities={activities} />
        </TabsContent>

        <TabsContent value="journal">
          {user && (
            <JournalTab
              uid={user.uid}
              adventureId={adventureId}
              initialContent={adventure.storyContent ?? ""}
            />
          )}
        </TabsContent>

        <TabsContent value="packing">
          <PackingList
            items={adventure.packingList ?? []}
            onChange={handlePackingListChange}
            gearItems={gearItems}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
