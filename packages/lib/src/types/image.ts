export type ImageMeta = {
  id: string;

  // Storage refs / URLs
  gsUrl?: string;     // gs://...
  url?: string;       // download URL

  // EXIF-ish metadata (optional)
  width?: number;
  height?: number;
  takenAt?: string;   // ISO string

  lat?: number;
  lon?: number;
};
