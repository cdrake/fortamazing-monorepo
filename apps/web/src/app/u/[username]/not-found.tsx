import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-4xl font-bold mb-4">User Not Found</h1>
      <p className="text-lg text-gray-600">The user profile you are looking for does not exist.</p>
      <Link href="/" className="text-blue-500 hover:underline mt-4 inline-block">
        Return to Home
      </Link>
    </div>
  );
}
