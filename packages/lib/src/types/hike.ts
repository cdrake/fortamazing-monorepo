import type { ImageMeta } from "./image";
import type { Track } from "./track";

export type Hike = {
  id: string;
  uid: string;

  title: string;
  descriptionMd?: string;

  // Firestore timestamp (we can tighten later)
  createdAt?: unknown;
  updatedAt?: unknown;

  track?: Track;
  images?: ImageMeta[];
};
