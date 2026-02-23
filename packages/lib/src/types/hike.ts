import type { LatLng, BBox } from "./geoTypes";
import type { Difficulty } from "./difficulty";
import type { Privacy } from "./privacy";
import type { HikePhoto } from "./hikePhoto";
import type { SummaryStats } from "./summaryStats";
import type { Activity } from "./activity";

/** @deprecated Use Activity instead. Hike is kept as an alias during migration. */
export type Hike = Activity;

/** Original Hike shape — kept for reference during migration. */
export type LegacyHike = {
  ownerId: string;
  title: string;
  description?: string;

  createdAt: string; // ISO
  updatedAt: string; // ISO

  startTime?: string; // ISO
  endTime?: string;   // ISO

  distanceMeters?: number;
  movingTimeSeconds?: number;
  elevationGainMeters?: number;

  difficulty?: Difficulty;
  privacy: Privacy;
  public: boolean;

  startLocation?: LatLng;
  endLocation?: LatLng;

  bbox?: BBox;
  geohash?: string;

  encodedPolyline?: string;
  polylineSimplifiedResolution?: number;

  trackStoragePath?: string;

  photoCount?: number;
  photos?: HikePhoto[];

  elevationHistogram?: number[];
  tags?: string[];
  friends?: string[];

  summaryStats?: SummaryStats;
};
