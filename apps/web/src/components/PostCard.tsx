"use client";

import Image from "next/image";
import { deletePost } from "@/lib/firebase";

interface Post {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  imageUrl: string;
  caption: string;
  categories: string[];
  subcategories: string[];
  tags: string[];
  date?: string;
  time?: string;
  createdAt: string;
}

interface PostCardProps {
  post: Post;
  userId?: string;
  isSocialAdmin: boolean;
  refreshPosts: () => void;
}

export default function PostCard({ post, userId, isSocialAdmin, refreshPosts }: PostCardProps) {
  const handleDelete = async () => {
    try {
      await deletePost(post.id, post.imageUrl);
      refreshPosts();
    } catch (error) {
      console.error("Failed to delete post:", error);
    }
  };

  return (
    <div className="border p-2 rounded shadow-md hover:shadow-lg transition-shadow duration-200">
      {/* ✅ Post Image */}
      <Image
        src={post.imageUrl}
        alt="User post"
        width={300}
        height={300}
        className="rounded"
        unoptimized
      />

      {/* ✅ Post Metadata */}
      <p className="text-sm text-gray-500 mt-1">👤 {post.userName}</p>

      {/* ✅ Categories */}
      <p className="text-md font-bold">📂 {post.categories.join(", ")}</p>

      {/* ✅ Subcategories */}
      {post.subcategories.length > 0 && (
        <p className="text-sm italic text-gray-600">🔖 {post.subcategories.join(", ")}</p>
      )}

      {/* ✅ Post Caption */}
      <p className="text-md my-2">{post.caption}</p>

      {/* ✅ Event Date & Time (If category is Event) */}
      {post.categories.includes("Event") && post.date && post.time && (
        <p className="text-sm text-blue-600 font-bold">
          📅 {post.date} at 🕒 {post.time}
        </p>
      )}

      {/* ✅ Tags */}
      <div className="flex gap-2 flex-wrap mt-2">
        {post.tags.map((tag) => (
          <span key={tag} className="bg-gray-200 text-sm px-2 py-1 rounded">
            #{tag}
          </span>
        ))}
      </div>

      {/* ✅ Delete Button for Owners/Admins */}
      {(userId === post.userId || isSocialAdmin) && (
        <button
          onClick={handleDelete}
          className="mt-2 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
        >
          Delete
        </button>
      )}
    </div>
  );
}
