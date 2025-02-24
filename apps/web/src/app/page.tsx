"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import PostList from "@/components/PostList";
import { fetchPosts, Post } from "@/lib/firebase";
import { auth, getUserRole } from "@/lib/firebase";

// ✅ Define main categories
const categories = ["Exercise", "Diet", "Wellness", "Event", "Equipment"];

export default function HomePage() {
  const pathname = usePathname();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSocialAdmin, setIsSocialAdmin] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const loadUserRole = async () => {
      if (user) {
        const role = await getUserRole(user);
        setIsSocialAdmin(role === "social-admin");
      }
    };
    loadUserRole();
  }, [user]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        const pathParts = pathname.split("/").filter(Boolean); // Remove empty parts

        const filter: {
          categories?: string[];
          subcategories?: string[];
          tag?: string;
          userId?: string;
        } = {};

        // ✅ Filter by category or user
        if (pathParts[0] === "c" && pathParts.length >= 2) {
          filter.categories = [pathParts[1]]; 
          if (pathParts.length >= 3) {
            filter.subcategories = [pathParts[2]]; 
          }
        } else if (pathParts[0] === "u" && pathParts.length >= 2) {
          filter.userId = pathParts[1]; 
        }

        const fetchedPosts = await fetchPosts(filter);
        setPosts(fetchedPosts);
      } catch (error) {
        console.error("Error fetching posts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [pathname]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to Fort Amazing</h1>

      {/* ✅ Category Links */}
      <h2 className="text-lg font-semibold">Browse by Category</h2>
      <div className="flex gap-4 my-2">
        {categories.map((category) => (
          <Link
            key={category}
            href={`/c/${category.toLowerCase()}`}
            className="text-blue-500 hover:underline"
          >
            {category}
          </Link>
        ))}
        {/* 🔥 Direct Link to Diet Log */}
        <Link href="/diet" className="text-red-500 hover:underline">
          Diet Log
        </Link>
      </div>

      {/* ✅ Navigation Options */}
      <div className="mb-4 flex gap-4">
        {user ? (
          <>
            <Link href="/settings" className="text-blue-500 hover:underline">
              Settings
            </Link>
            <Link
              href={`/u/${encodeURIComponent(
                (user.email || "").replace(/@/g, ".")
              )}`}
              className="text-blue-500 hover:underline"
            >
              My Profile
            </Link>
          </>
        ) : (
          <Link href="/login" className="text-green-500 hover:underline">
            Sign In
          </Link>
        )}
      </div>

      {/* ✅ Post List */}
      {loading ? (
        <p>Loading posts...</p>
      ) : (
        <PostList posts={posts} isSocialAdmin={isSocialAdmin} />
      )}
    </div>
  );
}
