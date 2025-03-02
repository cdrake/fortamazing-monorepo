'use client'
import useSWR from 'swr'
import { fetchPosts } from '@/lib/firebase'
import PostList from '@/components/PostList'
import { auth, getUserRole } from '@/lib/firebase'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function CategoryPage() {
  const params = useParams()
  const category = Array.isArray(params!.category) ? params!.category[0] : params!.category
  const [isSocialAdmin, setIsSocialAdmin] = useState(false)

  // ✅ Fetch user role dynamically
  useEffect(() => {
    const checkUserRole = async () => {
      const user = auth.currentUser
      if (user) {
        const role = await getUserRole(user)
        setIsSocialAdmin(role === 'social-admin')
      }
    }
    checkUserRole()
  }, [])

  // ✅ Fetch posts dynamically with SWR
  const { data: posts, error } = useSWR(
    category ? `category/${category}` : null,
    () => fetchPosts({ categories: [category] })
  )

  if (error) return <p>Failed to load posts for {category}</p>
  if (!posts) return <p>Loading posts...</p>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{category.toUpperCase()} Posts</h1>
      <PostList posts={posts} isSocialAdmin={isSocialAdmin} />
    </div>
  )
}
