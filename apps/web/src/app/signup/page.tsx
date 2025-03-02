'use client'
import { useEffect, useState, useMemo } from "react";
import { getAuth, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, sendVerificationEmail } from "@/lib/firebase";
import { setDoc, doc } from "firebase/firestore";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weight, setWeight] = useState("");
  const [sex, setSex] = useState("unspecified");

  const auth = useMemo(() => getAuth(), []);

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const storedEmail = window.localStorage.getItem("emailForSignIn");
      if (storedEmail) {
        setEmail(storedEmail);
      }
    }
  }, [auth]);

  const handleSignup = async () => {
    if (!email) return;
    
    try {
      const result = await signInWithEmailLink(auth, email, window.location.href);
      await sendVerificationEmail();
      
      const userRef = doc(db, "users", result.user.uid);
      await setDoc(userRef, {
        uid: result.user.uid,
        email: result.user.email,
        role: "user",
        createdAt: new Date().toISOString(),
        birthDate,
        weight: parseFloat(weight) || 0,
        sex
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
      <input
        type="date"
        placeholder="Enter your birth date"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      <input
        type="number"
        placeholder="Enter your weight (kg)"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      />
      <select
        value={sex}
        onChange={(e) => setSex(e.target.value)}
        className="border p-2 rounded w-full mb-2"
      >
        <option value="unspecified">Unspecified</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </select>
      <button onClick={handleSignup} className="bg-blue-500 text-white px-4 py-2 rounded w-full">
        Complete Signup
      </button>
    </div>
  );
}
