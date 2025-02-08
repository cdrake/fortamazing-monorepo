"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, signInWithGoogle, logout } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import Image from "next/image";

export default function AppBar() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);

      // ✅ If user is logged in, redirect to Dashboard
      if (user) {
        router.push("/dashboard");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    router.push("/"); // ✅ Redirect to home after logout
  };

  return (
    <nav className="flex items-center justify-between p-4 bg-gray-900 text-white">
      <h1 className="text-xl font-bold cursor-pointer" onClick={() => router.push("/")}>
        Fort Amazing
      </h1>

      {user ? (
        <div className="flex items-center gap-4">
          <Image
            src={user.photoURL || "/default-avatar.png"}
            alt="Profile"
            width={40}
            height={40}
            className="rounded-full"
            unoptimized
          />
          <button onClick={handleSignOut} className="bg-red-500 px-3 py-1 rounded">
            Sign Out
          </button>
        </div>
      ) : (
        <button onClick={signInWithGoogle} className="bg-blue-500 px-3 py-1 rounded">
          Sign In
        </button>
      )}
    </nav>
  );
}
