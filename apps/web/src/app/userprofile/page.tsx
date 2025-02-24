"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchPosts, Post, getUserProfile, UserProfile } from "@/lib/firebase";
import PostList from "@/components/PostList";
import Image from "next/image";

export default function UserProfilePage() {
  const { username } = useParams();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;

    const loadUserProfile = async () => {
      try {
        const profile = await getUserProfile(username as string);
        setUserProfile(profile);
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    loadUserProfile();
  }, [username]);

  useEffect(() => {
    if (!username) return;

    const loadPosts = async () => {
      try {
        const fetchedPosts = await fetchPosts({ userId: username as string });
        setPosts(fetchedPosts);
      } catch (error) {
        console.error("Error fetching posts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [username]);

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

          <h2 className="text-xl font-semibold mb-4">Posts by {userProfile.displayName || userProfile.username}</h2>
        </>
      ) : (
        <h2 className="text-xl font-semibold mb-4">User not found</h2>
      )}

      {loading ? <p>Loading posts...</p> : <PostList posts={posts} isSocialAdmin={false} />}
    </div>
  );
}
