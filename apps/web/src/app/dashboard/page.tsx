"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, fetchPosts, deletePost, Post, getUserRole } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Image from "next/image";
import PostUploader from "@/components/PostUploader";

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [user, setUser] = useState(auth.currentUser);
  const [isSocialAdmin, setIsSocialAdmin] = useState(false);
  const [loading, setLoading] = useState(true); // ✅ Track authentication state
  const router = useRouter();

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
      setLoading(false); // ✅ Authentication is complete

      // ✅ Check user role (social admin)
      const role = await getUserRole(user);
      setIsSocialAdmin(role === "social-admin");
    });

    return () => unsubscribe();
  }, [router]);
  

  // ✅ Function to refresh posts
  const loadPosts = async () => {
    const fetchedPosts: Post[] = await fetchPosts();
    setPosts(fetchedPosts);
  };

  useEffect(() => {    
    loadPosts();
  }, []);

  // ✅ Handle post deletion
  const handleDelete = async (postId: string, imageUrl: string) => {
    await deletePost(postId, imageUrl);
    setPosts(posts.filter((post) => post.id !== postId)); // Remove post from state
  };

  if (loading) {
    return <p>Loading...</p>; // ✅ Prevent rendering before authentication completes
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <PostUploader onPostUploaded={loadPosts} />

      <h2 className="text-xl font-bold mt-4">Recent Posts</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        {posts.length > 0 ? (
          posts.map((post) => (
            <div key={post.id} className="border p-2 rounded shadow">
              <Image
                src={post.imageUrl}
                alt="User post"
                width={300}
                height={300}
                className="rounded"
                unoptimized
              />
              <p className="text-sm text-gray-500 mt-1">{post.userName}</p>
              <p className="text-md">{post.caption}</p>

              {/* ✅ Show delete button for post owners & Social Admins */}
              {(user?.uid === post.userId || isSocialAdmin) && (
                <button
                  onClick={() => handleDelete(post.id, post.imageUrl)}
                  className="mt-2 bg-red-500 text-white px-3 py-1 rounded"
                >
                  Delete
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="text-gray-500">No posts yet. Upload one above!</p>
        )}
      </div>
    </div>
  );
}
