"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { updateAdventure } from "@/lib/adventures"

type Props = {
  uid: string
  adventureId: string
  initialContent: string
}

export default function JournalTab({ uid, adventureId, initialContent }: Props) {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync if parent re-fetches
  useEffect(() => {
    setContent(initialContent)
  }, [initialContent])

  const save = useCallback(
    async (text: string) => {
      setSaving(true)
      try {
        await updateAdventure(uid, adventureId, { storyContent: text })
      } catch (err) {
        console.error("Failed to save journal:", err)
      } finally {
        setSaving(false)
      }
    },
    [uid, adventureId],
  )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setContent(val)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void save(val)
    }, 500)
  }

  // Save on unmount if pending
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Journal</h3>
        {saving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Write about your adventure..."
        className="w-full min-h-[300px] p-3 border rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
  )
}
