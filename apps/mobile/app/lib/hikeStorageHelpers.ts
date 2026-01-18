// src/lib/storageHelpers.ts
import { getStorage, ref as storageRef, getDownloadURL, getMetadata } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { auth } from "@/config/firebase";

/**
 * Normalize a stored path into an objectPath (no leading bucket).
 * Accepts:
 *  - "gs://bucket-name/path/to/object.jpg"
 *  - "gs://users/uid/..."         (bogus first segment)
 *  - "/users/uid/..."
 *  - "users/uid/..."
 *  - full https:// URL (returned unchanged by main helper)
 */
export function normalizeToObjectPath(input?: string): string | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (s.startsWith("gs://")) {
    const without = s.replace(/^gs:\/\//, "");
    const firstSlash = without.indexOf("/");
    if (firstSlash === -1) return without; // unlikely
    const first = without.slice(0, firstSlash);
    const rest = without.slice(firstSlash + 1);
    // if `first` looks like a bucket (contains a dot) treat `rest` as objectPath,
    // otherwise (e.g. "users") also return rest (we assume bucket comes from config).
    return rest;
  }
  if (s.startsWith("/")) return s.slice(1);
  return s;
}

/**
 * Extract bucket name from a gs://... string (if present)
 */
export function bucketFromGs(input?: string): string | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (!s.startsWith("gs://")) return undefined;
  const without = s.replace(/^gs:\/\//, "");
  const firstSlash = without.indexOf("/");
  if (firstSlash === -1) return without;
  return without.slice(0, firstSlash);
}

/**
 * Construct a REST download URL given a bucket, objectPath, and token.
 * NOTE: token is the legacy "firebaseStorageDownloadTokens" value from metadata.
 */
function restDownloadUrlFor(bucket: string, objectPath: string, token?: string) {
  const encoded = encodeURIComponent(objectPath);
  let url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media`;
  if (token) url += `&token=${encodeURIComponent(token)}`;
  return url;
}

/**
 * gsPathToDownloadUrl
 * - Accepts gs://..., object paths, and http(s) URLs.
 * - Attempts getDownloadURL(ref). If it fails, tries getMetadata and constructs a REST URL
 *   if a download token exists in metadata (firebaseStorageDownloadTokens).
 *
 * Returns: a HTTP(S) download URL string or undefined if resolution failed.
 */
export async function gsPathToDownloadUrl(stored?: string): Promise<string | undefined> {
  if (!stored) return undefined;
  console.log("[gsPathToDownloadUrl] resolving stored path:", stored);
  // If already an http(s) URL, return unchanged
  if (/^https?:\/\//i.test(stored)) {
    return stored;
  }

  // If data URL
  if (/^data:/i.test(stored)) return stored;

  const storage = getStorage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configuredBucket = (storage as any).app?.options?.storageBucket;
  // auth info may help debugging
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uid = (auth as any)?.currentUser?.uid ?? getAuth()?.currentUser?.uid ?? null;
    console.debug("[gsPathToDownloadUrl] currentUser:", uid);
  } catch {}

  // Normalize object path (strip gs://<bucket>/ if present)
  const objectPath = normalizeToObjectPath(stored);
  const explicitBucket = bucketFromGs(stored);

  if (!objectPath) {
    console.warn("[gsPathToDownloadUrl] empty objectPath after normalization:", stored);
    return undefined;
  }

  // Try SDK getDownloadURL first (best, respects rules/auth)
  try {
    console.debug("[gsPathToDownloadUrl] attempting getDownloadURL for objectPath:", objectPath, "configuredBucket:", configuredBucket, "explicitBucket:", explicitBucket);
    const ref = storageRef(storage, objectPath);
    const dl = await getDownloadURL(ref);
    console.debug("[gsPathToDownloadUrl] getDownloadURL succeeded:", dl);
    return dl;
  } catch (err: any) {
    // Log the error details
    console.warn("[gsPathToDownloadUrl] getDownloadURL failed for", objectPath, "error:", err?.code ?? err?.message ?? err);
    // Continue to try metadata/token-based approach below
  }

  // Try to fetch metadata and look for legacy download token
  try {
    const ref = storageRef(storage, objectPath);
    const meta = await getMetadata(ref);
    console.debug("[gsPathToDownloadUrl] metadata retrieved:", { fullPath: meta.fullPath, size: meta.size, updated: meta.updated });
    // download tokens historically live under custom metadata key 'firebaseStorageDownloadTokens'
    // but the exact key can vary. look for common places
    // @ts-ignore
    const md: any = (meta as any).metadata ?? (meta as any).customMetadata ?? {};
    const rawToken = md?.firebaseStorageDownloadTokens ?? md?.downloadTokens ?? md?.downloadToken;
    if (rawToken) {
      // tokens may be comma-separated list; pick first
      const token = String(rawToken).split(",")[0].trim();
      const bucketToUse = explicitBucket ?? configuredBucket;
      if (bucketToUse) {
        const rest = restDownloadUrlFor(bucketToUse, objectPath, token);
        console.debug("[gsPathToDownloadUrl] constructed REST URL from metadata token:", rest);
        return rest;
      } else {
        console.warn("[gsPathToDownloadUrl] token present but no bucket available to build REST URL");
      }
    } else {
      console.debug("[gsPathToDownloadUrl] metadata has no firebaseStorageDownloadTokens", md);
    }
  } catch (metaErr: any) {
    console.warn("[gsPathToDownloadUrl] getMetadata failed for", objectPath, "error:", metaErr?.code ?? metaErr?.message ?? metaErr);
  }

  // If the stored value included a different explicit bucket, as a last-ditch try build a REST URL without token.
  // This rarely works (will usually get 403) but sometimes the bucket is public or CORS allows it.
  if (explicitBucket) {
    try {
      const trial = restDownloadUrlFor(explicitBucket, objectPath);
      console.debug("[gsPathToDownloadUrl] trying REST URL without token for explicit bucket:", trial);
      // Attempt a HEAD fetch to check existence (use fetch; in RN fetch is available)
      try {
        const res = await fetch(trial, { method: "HEAD" });
        if (res.ok) {
          console.debug("[gsPathToDownloadUrl] HEAD succeeded on REST URL without token -> returning:", trial);
          return trial;
        } else {
          console.debug("[gsPathToDownloadUrl] HEAD on REST URL returned", res.status);
        }
      } catch (fetchErr) {
        console.debug("[gsPathToDownloadUrl] fetch HEAD failed for", trial, fetchErr);
      }
    } catch (e) {
      // ignore
    }
  }

  console.warn("[gsPathToDownloadUrl] all resolution attempts failed for:", stored);
  return undefined;
}
