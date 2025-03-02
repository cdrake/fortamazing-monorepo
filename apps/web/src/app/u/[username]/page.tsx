'use client'
import useSWR from 'swr'
import { auth, db, collection, query, where, getDocs, doc, getDoc, updateDoc } from '../../../lib/firebase'
import Image from 'next/image'
import PostList from '@/components/PostList'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { onAuthStateChanged, User } from 'firebase/auth'

export const dynamic = 'force-dynamic' // ✅ Ensure dynamic rendering

const calculateAge = (birthDate: string) => {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export default function UserProfilePage() {
  const params = useParams()
  const username = Array.isArray(params!.username) ? params!.username[0] : params!.username
  const [currentUser, setCurrentUser] = useState<User | null>(null) // ✅ Track logged-in user
  const [userId, setUserId] = useState<string | null>(null) // ✅ Store fetched user ID
  const [updating, setUpdating] = useState(false)

  // ✅ Monitor Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
    })
    return () => unsubscribe()
  }, [])

  // ✅ Fetch UID for the given username
  useEffect(() => {
    const fetchUserId = async () => {
      if (!username) return
      const usersQuery = query(collection(db, 'users'), where('username', '==', username))
      const querySnapshot = await getDocs(usersQuery)
      if (!querySnapshot.empty) {
        setUserId(querySnapshot.docs[0].id) // ✅ Store the UID
      }
    }
    fetchUserId()
  }, [username])

  // ✅ Fetch User Profile by UID
  const fetchUserProfile = async () => {
    if (!userId) return null
    console.log('Fetching profile for user ID:', userId)
    const userDoc = await getDoc(doc(db, `users/${userId}`))
    return userDoc.exists() ? userDoc.data() : null
  }

  const { data: userProfile, error, mutate } = useSWR(userId ? `user/${userId}` : null, fetchUserProfile)

  const toggleVisibility = async (field: string) => {
    if (!userProfile || !userId) return
    setUpdating(true)
    try {
      const userRef = doc(db, `users/${userId}`)
      await updateDoc(userRef, {
        [field]: !userProfile[field]
      })
      mutate()
    } catch (err) {
      console.error('Error updating visibility:', err)
    }
    setUpdating(false)
  }

  if (error) return <div>Error loading profile</div>
  if (!userProfile) return <div>Loading profile...</div>

  const isOwner = currentUser?.uid === userId // ✅ Only owner sees private info

  return (
    <div className="p-4">
      <h1>User Details</h1>
      <div className="flex items-center gap-4 mb-4">
        <Image
          src={userProfile.profilePicture || "/default-avatar.png"}
          alt="Profile"
          width={64}
          height={64}
          className="rounded-full"
          priority
        />
        <div>
          <h1 className="text-2xl font-bold">{userProfile.name || username}</h1>
          <p className="text-gray-600">@{username}</p>
          {userProfile.shareEmail && <p className="text-sm text-gray-500">{userProfile.email}</p>}

          {/* ✅ Weight Visibility */}
          <p className="text-sm text-gray-500 flex items-center">
            Weight: {isOwner || userProfile.shareWeight ? `${userProfile.weight} kg` : 'Hidden'}
            {isOwner && (
              <button
                className="ml-2 text-blue-500 text-sm"
                onClick={() => toggleVisibility('shareWeight')}
                disabled={updating}
              >
                {userProfile.shareWeight ? 'Hide' : 'Show'}
              </button>
            )}
          </p>

          {/* ✅ Sex Visibility */}
          <p className="text-sm text-gray-500 flex items-center">
            Sex: {isOwner || userProfile.shareSex ? userProfile.sex : 'Hidden'}
            {isOwner && (
              <button
                className="ml-2 text-blue-500 text-sm"
                onClick={() => toggleVisibility('shareSex')}
                disabled={updating}
              >
                {userProfile.shareSex ? 'Hide' : 'Show'}
              </button>
            )}
          </p>

          {/* ✅ Age Visibility */}
          <p className="text-sm text-gray-500 flex items-center">
            Age: {isOwner || userProfile.shareAge ? calculateAge(userProfile.birthDate) : 'Hidden'}
            {isOwner && (
              <button
                className="ml-2 text-blue-500 text-sm"
                onClick={() => toggleVisibility('shareAge')}
                disabled={updating}
              >
                {userProfile.shareAge ? 'Hide' : 'Show'}
              </button>
            )}
          </p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">Posts by {userProfile.name || username}</h2>
      <PostList posts={[]} isSocialAdmin={false} />
    </div>
  )
}
