/**
 * migrate-hikes-to-activities.ts
 *
 * Migrates all hike documents from users/{uid}/hikes/{hikeId}
 * to users/{uid}/activities/{hikeId} (same doc ID).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx tsx scripts/migrate-hikes-to-activities.ts
 *
 * Strategy:
 *  - Collection group query on all hikes
 *  - For each, create activities doc with same ID under same user
 *  - GPS fields nested under `track.*`
 *  - `privacy` derived from `public` boolean
 *  - `ownerId` from `owner.uid`
 *  - `migratedFromHikeId` for audit trail
 *  - Storage files NOT moved — activity docs reference the same gs:// paths
 *  - Idempotent: skip if activity doc already exists
 *  - Batch writes of 500
 */

import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const BATCH_SIZE = 500

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert(
      process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "./service-account.json"
    ),
  })
}

const db = getFirestore()

interface HikeDoc {
  owner?: { uid: string; email?: string; displayName?: string; username?: string }
  public?: boolean
  title?: string
  description?: string
  descriptionMd?: string
  createdAt?: FirebaseFirestore.Timestamp | string
  days?: Array<{
    id?: string
    name?: string
    geojson?: unknown
    geojsonUrl?: string
    geojsonPath?: string
    stats?: Record<string, unknown>
    color?: string | null
    visible?: boolean
  }>
  images?: Array<{
    path?: string
    url?: string
    filename?: string
    contentType?: string
    lat?: number | null
    lon?: number | null
    meta?: Record<string, unknown>
  }>
  combinedPath?: string
  combinedUrl?: string
  combinedGeojson?: unknown
  distanceMeters?: number
  movingTimeSeconds?: number
  elevationGainMeters?: number
  startLocation?: unknown
  endLocation?: unknown
  bbox?: unknown
  geohash?: string
  encodedPolyline?: string
  polylineSimplifiedResolution?: number
  trackStoragePath?: string
  elevationHistogram?: number[]
  summaryStats?: unknown
  tags?: string[]
  friends?: string[]
  difficulty?: string
  startTime?: string
  endTime?: string
  bounds?: unknown
}

function toISOString(
  ts: FirebaseFirestore.Timestamp | string | undefined
): string {
  if (!ts) return new Date().toISOString()
  if (typeof ts === "string") return ts
  if (typeof (ts as FirebaseFirestore.Timestamp).toDate === "function") {
    return (ts as FirebaseFirestore.Timestamp).toDate().toISOString()
  }
  return new Date().toISOString()
}

async function migrate() {
  console.log("Starting hike → activity migration...")

  // Collection group query gets all hikes subcollections
  const hikesSnapshot = await db.collectionGroup("hikes").get()
  console.log(`Found ${hikesSnapshot.size} hike documents`)

  let migrated = 0
  let skipped = 0
  let errors = 0
  let batch = db.batch()
  let batchCount = 0

  for (const hikeDoc of hikesSnapshot.docs) {
    const hikeId = hikeDoc.id
    const data = hikeDoc.data() as HikeDoc

    // Extract uid from doc path: users/{uid}/hikes/{hikeId}
    const pathParts = hikeDoc.ref.path.split("/")
    const uid = pathParts[1] // users/{uid}/hikes/{hikeId}

    if (!uid) {
      console.warn(`Skipping ${hikeDoc.ref.path}: could not extract uid`)
      errors++
      continue
    }

    // Check if activity doc already exists (idempotent)
    const activityRef = db
      .collection("users")
      .doc(uid)
      .collection("activities")
      .doc(hikeId)

    const existingActivity = await activityRef.get()
    if (existingActivity.exists) {
      skipped++
      continue
    }

    const ownerId = data.owner?.uid ?? uid
    const privacy = data.public ? "public" : "private"
    const createdAt = toISOString(data.createdAt)

    // Build the activity document
    const activityData: Record<string, unknown> = {
      ownerId,
      type: "hike",
      title: data.title ?? `Hike ${hikeId}`,
      description: data.descriptionMd ?? data.description ?? "",
      createdAt,
      updatedAt: createdAt,
      privacy,
      migratedFromHikeId: hikeId,

      // Backward-compat fields
      public: data.public ?? false,
      owner: data.owner ?? { uid: ownerId },
      descriptionMd: data.descriptionMd ?? "",
    }

    // Photos
    if (data.images && data.images.length > 0) {
      activityData.photos = data.images
      activityData.photoCount = data.images.length
      // Keep images for backward compat
      activityData.images = data.images
    }

    // GPS track data
    const track: Record<string, unknown> = {}
    if (data.distanceMeters != null) track.distanceMeters = data.distanceMeters
    if (data.movingTimeSeconds != null) track.movingTimeSeconds = data.movingTimeSeconds
    if (data.elevationGainMeters != null) track.elevationGainMeters = data.elevationGainMeters
    if (data.startLocation != null) track.startLocation = data.startLocation
    if (data.endLocation != null) track.endLocation = data.endLocation
    if (data.bbox != null) track.bbox = data.bbox
    if (data.geohash != null) track.geohash = data.geohash
    if (data.encodedPolyline != null) track.encodedPolyline = data.encodedPolyline
    if (data.polylineSimplifiedResolution != null) track.polylineSimplifiedResolution = data.polylineSimplifiedResolution
    if (data.trackStoragePath != null) track.trackStoragePath = data.trackStoragePath
    if (data.elevationHistogram != null) track.elevationHistogram = data.elevationHistogram
    if (data.days != null) track.days = data.days
    if (data.combinedPath != null) track.combinedPath = data.combinedPath
    if (data.combinedUrl != null) track.combinedUrl = data.combinedUrl
    if (data.combinedGeojson != null) track.combinedGeojson = data.combinedGeojson
    if (data.summaryStats != null) track.summaryStats = data.summaryStats

    if (Object.keys(track).length > 0) {
      activityData.track = track
    }

    // Flat backward-compat copies of GPS fields
    if (data.days != null) activityData.days = data.days
    if (data.combinedPath != null) activityData.combinedPath = data.combinedPath
    if (data.combinedUrl != null) activityData.combinedUrl = data.combinedUrl
    if (data.combinedGeojson != null) activityData.combinedGeojson = data.combinedGeojson
    if (data.distanceMeters != null) activityData.distanceMeters = data.distanceMeters
    if (data.movingTimeSeconds != null) activityData.movingTimeSeconds = data.movingTimeSeconds
    if (data.elevationGainMeters != null) activityData.elevationGainMeters = data.elevationGainMeters
    if (data.startLocation != null) activityData.startLocation = data.startLocation
    if (data.endLocation != null) activityData.endLocation = data.endLocation
    if (data.bbox != null) activityData.bbox = data.bbox
    if (data.geohash != null) activityData.geohash = data.geohash
    if (data.encodedPolyline != null) activityData.encodedPolyline = data.encodedPolyline
    if (data.trackStoragePath != null) activityData.trackStoragePath = data.trackStoragePath
    if (data.elevationHistogram != null) activityData.elevationHistogram = data.elevationHistogram
    if (data.summaryStats != null) activityData.summaryStats = data.summaryStats
    if (data.bounds != null) activityData.bounds = data.bounds

    // Other fields
    if (data.tags) activityData.tags = data.tags
    if (data.friends) activityData.friends = data.friends
    if (data.difficulty) activityData.difficulty = data.difficulty
    if (data.startTime) activityData.startTime = data.startTime
    if (data.endTime) activityData.endTime = data.endTime

    batch.set(activityRef, activityData)
    batchCount++
    migrated++

    if (batchCount >= BATCH_SIZE) {
      await batch.commit()
      console.log(`  Committed batch of ${batchCount} (${migrated} migrated so far)`)
      batch = db.batch()
      batchCount = 0
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit()
    console.log(`  Committed final batch of ${batchCount}`)
  }

  console.log("\nMigration complete!")
  console.log(`  Migrated: ${migrated}`)
  console.log(`  Skipped (already exists): ${skipped}`)
  console.log(`  Errors: ${errors}`)
  console.log(`  Total hike docs: ${hikesSnapshot.size}`)
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
