"use client";
import PostCard from "@/components/PostCard";
import { Post } from "@/lib/firebase";

interface PostListProps {
  posts: Post[];
  userId?: string;
  isSocialAdmin: boolean;
}

export default function PostList({ posts, userId, isSocialAdmin }: PostListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {posts.length > 0 ? (
        posts.map((post) => (
          <PostCard key={post.id} post={post} userId={userId} isSocialAdmin={isSocialAdmin} refreshPosts={() => {}} />
        ))
      ) : (
        <p className="text-gray-500">No posts found.</p>
      )}
    </div>
  );
}
