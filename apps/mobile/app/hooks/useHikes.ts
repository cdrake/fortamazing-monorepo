// src/hooks/useHikes.ts
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { listHikes, Hike } from "@/lib/hikes";

export function useHikes() {
  const { authEmail } = useAuth(); // existing API stores email; use authToken or Firebase currentUser if you migrated
  const [hikes, setHikes] = useState<Hike[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Prefer using Firebase auth user uid if you have it; fall back to email
      // If you have firebaseAuth.currentUser available, use it instead.
      const data = await listHikes(/* ownerUid: optional */ undefined);
      setHikes(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, authEmail]);

  return { hikes, loading, reload: load };
}
