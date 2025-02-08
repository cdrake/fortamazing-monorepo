"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, getUserRole, generateInvite, fetchInvites, deleteInvite } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function AdminPage() {
  const router = useRouter();
  const [isSocialAdmin, setIsSocialAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<{ id: string; email: string; code: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ✅ Check if the user is a social admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      const role = await getUserRole(null);
      if (role === "social-admin") {
        setIsSocialAdmin(true);
      } else {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // ✅ Fetch invites once after checking user role
  useEffect(() => {
    if (isSocialAdmin) {
      fetchInvites()
      .then((data) => {
        console.log("Fetched Invites:", data); // ✅ Debugging log
        setInvites(data); 
      })
      .catch((err) => setError(err.message));
    }
  }, [isSocialAdmin]);

  // ✅ Handle generating an invite
  const handleGenerateInvite = async () => {
    try {
      const inviteCode = await generateInvite(email);
      setInvites([...invites, { id: inviteCode, email, code: inviteCode }]); // ✅ Add new invite
      setEmail(""); // ✅ Clear input
      setError(null); // ✅ Clear any previous errors
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    }
  };

  // ✅ Handle deleting an invite
  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await deleteInvite(inviteId);
      setInvites(invites.filter((invite) => invite.id !== inviteId)); // ✅ Remove invite from state
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    }
  };

  // ✅ If user is not a Social Admin, do not render the page
  if (!isSocialAdmin) return null;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Social Admin - Manage Invites</h1>

      <div className="mb-4">
        <input
          type="email"
          placeholder="User Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded w-full mb-2"
        />
        <button onClick={handleGenerateInvite} className="bg-green-500 text-white px-4 py-2 rounded w-full">
          Generate Invite
        </button>
      </div>

      {error && <p className="text-red-500">{error}</p>}

      <h2 className="text-xl font-bold mt-4">Existing Invites</h2>
      <ul>
        {invites.length > 0 ? (
          invites.map((invite) => (
            <li key={invite.id} className="border p-2 rounded flex justify-between items-center">
              <div>
                <p><strong>Email:</strong> {invite.email}</p>
                <p><strong>Code:</strong> {invite.code}</p>
              </div>
              <button
                onClick={() => handleDeleteInvite(invite.id)}
                className="bg-red-500 text-white px-3 py-1 rounded"
              >
                Delete
              </button>
            </li>
          ))
        ) : (
          <p className="text-gray-500">No invites found.</p>
        )}
      </ul>
    </div>
  );
}
