export type HikePhoto = {
  path?: string;
  url?: string;
  filename?: string;
  contentType?: string;
  lat?: number | null;
  lon?: number | null;
  meta?: Record<string, unknown>;
};
