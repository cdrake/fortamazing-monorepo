"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, getUserRole, listActivities, type ActivityDoc } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

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
          {activities.map((a) => (
            <li key={a.id} className="p-3 border rounded">
              <div className="font-semibold">{a.title || "Untitled"}</div>
              <div className="text-sm text-gray-500">
                {a.type ?? "activity"} &middot; {a.privacy ?? "private"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
