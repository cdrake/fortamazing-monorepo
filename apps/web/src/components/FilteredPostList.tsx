"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { fetchPosts, Post, getUserRole } from "@/lib/firebase";
import PostList from "@/components/PostList";
import { auth } from "@/lib/firebase";

export default function FilteredPostList() {
  const { category, subcategory, tag } = useParams(); // ✅ Get filters from URL
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSocialAdmin, setIsSocialAdmin] = useState(false);

  useEffect(() => {
    const loadUserRole = async () => {
      const user = auth.currentUser;
      if (user) {
        const role = await getUserRole(user);
        setIsSocialAdmin(role === "social-admin");
      }
    };

    loadUserRole();
  }, []);

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        const filters = {
          categories: category ? [category as string] : [],
          subcategories: subcategory ? [subcategory as string] : [],
          tags: tag ? [tag as string] : [],
        };

        const fetchedPosts = await fetchPosts(filters);
        setPosts(fetchedPosts);
      } catch (error) {
        console.error("Error fetching posts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [category, subcategory, tag]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        {tag ? `Tag: ${tag}` : `Category: ${category || "All"}`}
      </h1>
      {subcategory && <h2 className="text-xl font-semibold mb-4">Subcategory: {subcategory}</h2>}

      {/* ✅ Filter Controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        {/* Category Filter */}
        <select
          value={category || ""}
          onChange={(e) => router.push(e.target.value ? `/c/${e.target.value}` : "/")}
          className="border p-2 rounded"
        >
          <option value="">All Categories</option>
          <option value="Exercise">Exercise</option>
          <option value="Diet">Diet</option>
          <option value="Wellness">Wellness</option>
          <option value="Event">Event</option>
          <option value="Equipment">Equipment</option>
        </select>

        {/* Subcategory Filter */}
        <select
          value={subcategory || ""}
          onChange={(e) =>
            router.push(e.target.value ? `/c/${category}/${e.target.value}` : `/c/${category}`)
          }
          className="border p-2 rounded"
          disabled={!category}
        >
          <option value="">All Subcategories</option>
          <option value="Strength">Strength</option>
          <option value="Cardio">Cardio</option>
          <option value="Keto">Keto</option>
          <option value="Vegan">Vegan</option>
        </select>

        {/* Tag Filter */}
        <input
          type="text"
          placeholder="Filter by tag"
          value={tag || ""}
          onChange={(e) => router.push(e.target.value ? `/t/${e.target.value}` : "/")}
          className="border p-2 rounded"
        />
      </div>

      {loading ? <p>Loading posts...</p> : <PostList posts={posts} isSocialAdmin={isSocialAdmin} />}
    </div>
  );
}
