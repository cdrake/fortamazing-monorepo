export type GearCategory =
  | "shelter"
  | "sleep"
  | "clothing"
  | "cooking"
  | "navigation"
  | "safety"
  | "hydration"
  | "electronics"
  | "footwear"
  | "other"

export type GearItem = {
  ownerId: string
  name: string
  category: GearCategory

  weight?: number
  brand?: string
  model?: string
  notes?: string

  photoUrl?: string
  photoPath?: string

  purchaseDate?: string
  retired?: boolean

  createdAt: string
  updatedAt: string
}
