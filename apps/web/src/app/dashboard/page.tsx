"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, getUserRole, fetchPosts, Post } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import PostList from "@/components/PostList";

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isSocialAdmin, setIsSocialAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);

  // ✅ Check Authentication and User Role
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

  // ✅ Fetch Posts
  useEffect(() => {
    const loadPosts = async () => {
      try {
        const fetchedPosts = await fetchPosts({});
        setPosts(fetchedPosts);
      } catch (error) {
        console.error("Error fetching posts:", error);
      }
    };

    loadPosts();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

      {/* ✅ Display All Posts */}
      <PostList posts={posts} userId={user?.uid} isSocialAdmin={isSocialAdmin} />
    </div>
  );
}
