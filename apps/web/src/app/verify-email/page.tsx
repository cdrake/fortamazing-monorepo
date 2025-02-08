"use client";
import { useEffect, useState } from "react";
import { getAuth, sendEmailVerification, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function VerifyEmailPage() {
  const auth = getAuth();
  const router = useRouter();
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      router.push("/");
    } else if (auth.currentUser.emailVerified) {
      router.push("/dashboard");
    } else {
      // ✅ Periodically check if email is verified every 5 seconds
      const interval = setInterval(async () => {
        await auth.currentUser?.reload(); // Refresh user data
        if (auth.currentUser?.emailVerified) {
          router.push("/dashboard");
        }
      }, 5000); // 5-second interval

      return () => clearInterval(interval);
    }
  }, [router, auth]);

  const handleResendEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
      setEmailSent(true);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Verify Your Email</h1>
      <p>Please check your inbox and click the verification link.</p>
      <button
        onClick={handleResendEmail}
        className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
      >
        Resend Verification Email
      </button>
      {emailSent && <p className="text-green-500 mt-2">Email sent! Check your inbox.</p>}
      <button
        onClick={handleSignOut}
        className="bg-red-500 text-white px-4 py-2 rounded mt-4"
      >
        Sign Out
      </button>
    </div>
  );
}
