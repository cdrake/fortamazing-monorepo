"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, signInWithGoogle, signInWithFacebook, createUserProfile } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth"; // ✅ Import User type

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null); // ✅ Explicitly type user state

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser); // ✅ No TypeScript error now
        router.push("/"); // ✅ Redirect after login
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        await createUserProfile(user); // ✅ Ensure user profile is created
        setUser(user); // ✅ Correctly set user
        router.push("/");
      }
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
  setLoading(true);
  try {
    const user = await signInWithFacebook();

    // If redirect is used, onAuthStateChanged will finish it.
    if (user) {
      await createUserProfile(user);
      setUser(user);
      router.push("/");
    }
  } catch (error) {
    console.error("Facebook login error:", error);
  } finally {
    setLoading(false);
  }
};


  if (loading) {
    return <p className="p-4">Loading...</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Sign In</h1>

      {user ? (
        <p className="text-green-500">You are already logged in.</p>
      ) : (
        <><button
            onClick={handleGoogleSignIn}
            className="bg-blue-500 text-white px-4 py-2 rounded w-full"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in with Google"}
          </button><button
            onClick={handleFacebookSignIn}
            className="bg-[#1877F2] text-white px-4 py-2 rounded w-full mt-3"
          >
              Sign in with Facebook
            </button></>

      )}
    </div>
  );
}
