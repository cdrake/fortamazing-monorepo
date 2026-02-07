"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, getUserRole, listActivities, type ActivityDoc } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import type { ActivityType, WorkoutData } from "@fortamazing/lib";
import { ACTIVITY_TYPE_ICON } from "@/lib/activityClassification";

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isSocialAdmin, setIsSocialAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityDoc[]>([]);

  // Check Authentication and User Role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      await user.reload();

      if (!user.emailVerified) {
        router.push("/verify-email");
        return;
      }

      setUser(user);

      const role = await getUserRole(user);
      setIsSocialAdmin(role === "social-admin");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch Activities
  useEffect(() => {
    const loadActivities = async () => {
      if (!user) return;
      try {
        const items = await listActivities(user.uid, 20);
        setActivities(items);
      } catch (error) {
        console.error("Error fetching activities:", error);
      }
    };

    loadActivities();
  }, [user]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

      <div className="mb-4">
        <Link href="/hikes" className="text-purple-600 hover:underline font-semibold">
          View all activities →
        </Link>
      </div>

      {activities.length === 0 ? (
        <p className="text-gray-500">No activities yet. Start by uploading a track!</p>
      ) : (
        <ul className="space-y-3">
          {activities.map((a) => {
            const icon = ACTIVITY_TYPE_ICON[(a.type as ActivityType) ?? "other"] ?? "🏔️";
            const workout = a.workout as WorkoutData | undefined;
            const isWorkout = a.type === "workout";
            return (
              <li key={a.id} className="p-3 border rounded">
                <div className="font-semibold">
                  <span className="mr-1">{icon}</span>
                  {a.title || "Untitled"}
                </div>
                <div className="text-sm text-gray-500">
                  {a.type ?? "activity"} &middot; {a.privacy ?? "private"}
                  {isWorkout && workout && (
                    <> &middot; {workout.exercises?.length ?? 0} exercises, {workout.exercises?.reduce((s, ex) => s + (ex.sets?.length ?? 0), 0) ?? 0} sets</>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
