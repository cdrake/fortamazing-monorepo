import {
  fetchPosts,
  Post,
  getUserProfile,
  UserProfile,
  getAllUsernames,
} from "@/lib/firebase";
import PostList from "@/components/PostList";
import Image from "next/image";
import { notFound } from "next/navigation"; // ✅ Import Next.js 404 redirect

// ✅ Ensure all usernames are URL-encoded for static generation
export async function generateStaticParams() {
  const users = await getAllUsernames();

  console.log(
    "Generating static params for users:",
    users.map((u) => u.username)
  ); // Debug log

  return users.map((user) => ({
    username: user.username.replace(/@/g, "."), // ✅ Replace "@" with "." for URL
  }));
}

// ✅ User profile page
export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  // console.log('params', params);
  // if (!username) {
  //   return notFound(); // ✅ Handle missing params
  // }

  const decodedUsername = decodeURIComponent(username); // ✅ Decode before lookup
  console.log("decoded username is", decodedUsername);
  try {
    const userProfile: UserProfile | null = await getUserProfile(
      decodedUsername
    );

    if (!userProfile) return notFound(); // ✅ 404 for missing users
    const posts: Post[] = await fetchPosts({ userId: decodedUsername });

    return (
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <Image
            src={userProfile.photoURL || "/default-avatar.png"} // ✅ Fallback image
            alt="Profile"
            width={64}
            height={64}
            className="rounded-full"
            priority
          />
          <div>
            <h1 className="text-2xl font-bold">
              {userProfile.displayName || userProfile.username}
            </h1>
            <p className="text-gray-600">@{userProfile.username}</p>
            <p className="text-sm text-gray-500">{userProfile.email}</p>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4">
          Posts by {userProfile.displayName || userProfile.username}
        </h2>
        <PostList posts={posts} isSocialAdmin={false} />
      </div>
    );
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return notFound(); // ✅ 404 for fetch errors
  }
}
