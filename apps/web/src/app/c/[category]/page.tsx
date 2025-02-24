import { fetchPosts, Post } from "@/lib/firebase"
import PostList from "@/components/PostList"
import { Metadata } from "next"
import { auth, getUserRole } from "@/lib/firebase"

type Params = Promise<{ category: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category } = await params

  return {
    title: `${category} | Fort Amazing`,
    description: `Explore posts in the ${category} category.`
  }
}

// ✅ Handle params as a Promise
export default async function CategoryPage({ params }: { params: Params }) {
  const { category } = await params

  let isSocialAdmin = false

  // ✅ Check user role if authenticated
  const user = auth.currentUser
  if (user) {
    const role = await getUserRole(user)
    isSocialAdmin = role === "social-admin"
  }

  try {
    const posts: Post[] = await fetchPosts({ categories: [category] })

    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{category.toUpperCase()} Posts</h1>
        <PostList posts={posts} isSocialAdmin={isSocialAdmin} />
      </div>
    )
  } catch (error) {
    console.error("Error fetching category posts:", error)
    return <p>Failed to load posts for {category}</p>
  }
}
