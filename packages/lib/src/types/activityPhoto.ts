export type ActivityPhoto = {
  path?: string
  url?: string
  filename?: string
  contentType?: string
  lat?: number | null
  lon?: number | null
  takenAt?: string
  meta?: Record<string, unknown>
}
