import type { Privacy } from "./privacy"

export type UserProfile = {
  uid: string
  username: string
  email: string
  displayName: string
  photoURL: string

  weight?: number
  sex?: string
  birthDate?: string

  shareEmail?: boolean
  shareWeight?: boolean
  shareSex?: boolean
  shareAge?: boolean

  role?: string
  preferredUnits?: "metric" | "imperial"
  defaultPrivacy?: Privacy

  createdAt?: string
  updatedAt?: string
}
