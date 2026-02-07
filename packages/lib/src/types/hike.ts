import type { LatLng, BBox } from "./geoTypes";
import type { Difficulty } from "./Difficulty";
import type { Privacy } from "./Privacy";
import type { HikePhoto } from "./HikePhoto";
import type { SummaryStats } from "./SummaryStats";

export type Hike = {
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
