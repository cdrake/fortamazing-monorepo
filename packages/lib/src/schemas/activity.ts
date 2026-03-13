import { z } from "zod"

// --- Geo schemas ---

const LatLngSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
})

const BBoxSchema = z.object({
  minLat: z.number(),
  minLng: z.number(),
  maxLat: z.number(),
  maxLng: z.number(),
})

const GeoJsonGeometrySchema = z.object({
  type: z.string(),
  coordinates: z.union([
    z.array(z.number()),
    z.array(z.array(z.number())),
    z.array(z.array(z.array(z.number()))),
  ]),
})

const GeoJsonFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: GeoJsonGeometrySchema,
  properties: z.record(z.string(), z.unknown()),
})

const GeoJsonFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(GeoJsonFeatureSchema),
})

// --- Stats schemas ---

const SummaryStatsSchema = z.object({
  totalDistanceMeters: z.number().optional(),
  totalMovingTimeSeconds: z.number().optional(),
  totalElevationGainMeters: z.number().optional(),
  totalElevationLossMeters: z.number().optional(),
  dayCount: z.number().optional(),
})

const DayTrackStatsSchema = z
  .object({
    distance_m: z.number().optional(),
    elevation: z
      .object({
        gain: z.number().optional(),
        loss: z.number().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .optional(),
    bounds: BBoxSchema.optional(),
  })
  .catchall(z.unknown())

// --- Day / Track schemas ---

const DayEntrySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  geojson: GeoJsonFeatureCollectionSchema.optional(),
  geojsonUrl: z.string().optional(),
  geojsonPath: z.string().optional(),
  stats: DayTrackStatsSchema.optional(),
  color: z.string().nullable().optional(),
  visible: z.boolean().optional(),
})

const GpsTrackDataSchema = z.object({
  distanceMeters: z.number().optional(),
  movingTimeSeconds: z.number().optional(),
  elevationGainMeters: z.number().optional(),
  elevationLossMeters: z.number().optional(),
  startLocation: LatLngSchema.optional(),
  endLocation: LatLngSchema.optional(),
  bbox: BBoxSchema.optional(),
  geohash: z.string().optional(),
  encodedPolyline: z.string().optional(),
  polylineSimplifiedResolution: z.number().optional(),
  trackStoragePath: z.string().optional(),
  elevationHistogram: z.array(z.number()).optional(),
  days: z.array(DayEntrySchema).optional(),
  combinedGeojson: GeoJsonFeatureCollectionSchema.optional(),
  combinedPath: z.string().optional(),
  combinedUrl: z.string().optional(),
  summaryStats: SummaryStatsSchema.optional(),
})

// --- Workout schemas ---

const ExerciseSetSchema = z.object({
  reps: z.number().optional(),
  weight: z.number().optional(),
  durationSeconds: z.number().optional(),
  distanceMeters: z.number().optional(),
  notes: z.string().optional(),
})

const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.array(ExerciseSetSchema),
  notes: z.string().optional(),
})

const WorkoutDataSchema = z.object({
  exercises: z.array(ExerciseSchema),
  notes: z.string().optional(),
})

// --- Photo schema ---

const ActivityPhotoSchema = z.object({
  path: z.string().optional(),
  url: z.string().optional(),
  filename: z.string().optional(),
  contentType: z.string().optional(),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
  takenAt: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})

// --- Enums ---

const ActivityTypeSchema = z.enum([
  "hike",
  "walk",
  "run",
  "bike",
  "climb",
  "ski",
  "kayak",
  "swim",
  "workout",
  "other",
])

const DifficultySchema = z.enum(["easy", "moderate", "hard", "expert"])

const PrivacySchema = z.enum(["private", "public", "friends"])

// --- Activity schema ---

export const ActivitySchema = z.object({
  ownerId: z.string(),
  type: ActivityTypeSchema,

  title: z.string(),
  description: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),

  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationSeconds: z.number().optional(),

  difficulty: DifficultySchema.optional(),
  privacy: PrivacySchema,

  tags: z.array(z.string()).optional(),
  friends: z.array(z.string()).optional(),

  photoCount: z.number().optional(),
  photos: z.array(ActivityPhotoSchema).optional(),

  adventureId: z.string().optional(),

  track: GpsTrackDataSchema.optional(),
  workout: WorkoutDataSchema.optional(),

  // Backward-compat fields
  public: z.boolean().optional(),
  owner: z.object({ uid: z.string() }).optional(),
  descriptionMd: z.string().optional(),
  days: z.array(DayEntrySchema).optional(),
  images: z.array(ActivityPhotoSchema).optional(),
  combinedPath: z.string().optional(),
  combinedUrl: z.string().optional(),
  combinedGeojson: GeoJsonFeatureCollectionSchema.optional(),
  bounds: BBoxSchema.optional(),
  geohash: z.string().optional(),
  encodedPolyline: z.string().optional(),
  distanceMeters: z.number().optional(),
  movingTimeSeconds: z.number().optional(),
  elevationGainMeters: z.number().optional(),
  startLocation: LatLngSchema.optional(),
  endLocation: LatLngSchema.optional(),
  bbox: BBoxSchema.optional(),
  trackStoragePath: z.string().optional(),
  elevationHistogram: z.array(z.number()).optional(),
  summaryStats: SummaryStatsSchema.optional(),
})

export type ActivityFromSchema = z.infer<typeof ActivitySchema>
