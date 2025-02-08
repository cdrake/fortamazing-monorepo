"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, fetchPosts, deletePost, getUserRole, Post } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import Image from "next/image";
import PostUploader from "@/components/PostUploader";
import InviteManager from "@/components/InviteManager";

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isSocialAdmin, setIsSocialAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);

      // ✅ Pass the `User` object instead of a string (UID)
      const role = await getUserRole(user);
      setIsSocialAdmin(role === "social-admin");
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (user) {
      const loadPosts = async () => {
        const fetchedPosts: Post[] = await fetchPosts();
        setPosts(fetchedPosts);
      };
      loadPosts();
    }
  }, [user]);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <PostUploader onPostUploaded={() => fetchPosts().then(setPosts)} />

      {isSocialAdmin && (
        <div className="bg-gray-100 p-4 rounded mt-4">
          <h2 className="text-xl font-bold">Admin Panel</h2>
          <InviteManager />
        </div>
      )}

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

              {(user?.uid === post.userId || isSocialAdmin) && (
                <button
                  onClick={() => deletePost(post.id, post.imageUrl).then(() => fetchPosts().then(setPosts))}
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
