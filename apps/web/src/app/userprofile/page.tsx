"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getUserProfile } from "@/lib/firebase";
import type { UserProfile } from "@/lib/firebase";
import Image from "next/image";

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>()!;

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;

    const loadUserProfile = async () => {
      try {
        const profile = await getUserProfile(username as string);
        setUserProfile(profile);
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [username]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-4">
      {userProfile ? (
        <>
          <div className="flex items-center gap-4 mb-4">
            <Image
              src={userProfile.photoURL}
              alt="Profile"
              width={64}
              height={64}
              className="rounded-full"
              priority
            />
            <div>
              <h1 className="text-2xl font-bold">{userProfile.displayName || userProfile.username}</h1>
              <p className="text-gray-600">@{userProfile.username}</p>
              <p className="text-sm text-gray-500">{userProfile.email}</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">Activities by {userProfile.displayName || userProfile.username}</h2>
          <p className="text-gray-500">Activity feed coming soon.</p>
        </>
      ) : (
        <h2 className="text-xl font-semibold mb-4">User not found</h2>
      )}
    </div>
  );
}
