"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, signInWithGoogle, createUserProfile } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        router.push("/"); // ✅ Redirect after login
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        await createUserProfile(user); // ✅ Ensure user profile is created
        router.push("/"); // ✅ Redirect after successful login
      }
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Sign In</h1>

      {user ? (
        <p className="text-green-500">You are already logged in.</p>
      ) : (
        <>
          <button
            onClick={handleGoogleSignIn}
            className="bg-blue-500 text-white px-4 py-2 rounded w-full"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in with Google"}
          </button>
        </>
      )}
    </div>
  );
}
