"use client";
import { useEffect, useState, useMemo } from "react";
import { getAuth, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, sendVerificationEmail } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  // ✅ Memoize auth so it doesn’t trigger re-renders
  const auth = useMemo(() => getAuth(), []);

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const storedEmail = window.localStorage.getItem("emailForSignIn");
      if (storedEmail) {
        setEmail(storedEmail);
      }
    }
  }, [auth]); // ✅ Include `auth` in the dependency array

  const handleSignup = async () => {
    if (!email) return;
  
    try {
      const result = await signInWithEmailLink(auth, email, window.location.href);
  
      // ✅ Send verification email
      await sendVerificationEmail();
  
      // ✅ Save user to Firestore
      await addDoc(collection(db, "users"), {
        uid: result.user.uid,
        email: result.user.email,
        role: "user",
        createdAt: new Date().toISOString(),
      });
  
      window.localStorage.removeItem("emailForSignIn");
      router.push("/dashboard");
    } catch (error) {
      console.error("Signup Error:", error);
    }
  };
  

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Sign Up</h1>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      <button onClick={handleSignup} className="bg-blue-500 text-white px-4 py-2 rounded w-full">
        Complete Signup
      </button>
    </div>
  );
}
