// src/app/hikes/lib/imageHelper.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * imageHelper.ts
 * Utilities for image handling: reading, EXIF extraction, HEIC conversion, EXIF copying.
 *
 * Usage:
 *  import {
 *    readFileAsDataURL,
 *    readFileAsBinaryString,
 *    extractExifFromFile,
 *    extractExifFromUrl,
 *    extractExifFromUrlWithFallback,
 *    convertHeicFileToJpegFile,
 *    copyExifFromJpegToJpeg,
 *    makeObjectUrl,
 *    revokeObjectUrl,
 *    hasGpsExif,
 *    readAllExifTags,
 *    debugExif,
 *  } from "./imageHelper";
 */
import { heicTo, isHeic } from "heic-to";

export type LatLon = { lat: number; lon: number } | null;

export type ConvertResult = {
  file: File;               // File to upload (converted or original)
  previewUrl?: string | null;
  converted: boolean;       // whether we converted to JPEG
  reason?: string | null;   // if not converted, why
};

/* --------------------------- Basic readers --------------------------- */

/** Read as Data URL (useful for <img src="data:...">) */
export function readFileAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(file);
  });
}

/** Read as ArrayBuffer */
export function readFileAsArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.readAsArrayBuffer(file);
  });
}

/** Read as binary string (used by piexifjs). Fallback converts ArrayBuffer -> binary string. */
export async function readFileAsBinaryString(file: File | Blob): Promise<string> {
  // FileReader.readAsBinaryString is deprecated in some environments; use ArrayBuffer fallback.
  try {
    // @ts-ignore
    if (typeof FileReader !== "undefined" && (FileReader.prototype as any).readAsBinaryString) {
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error);
        fr.onload = () => resolve(String(fr.result));
        // @ts-ignore
        fr.readAsBinaryString(file);
      });
    }
  } catch (e) {
    // fall through to arrayBuffer path
  }

  const ab = await readFileAsArrayBuffer(file);
  const u8 = new Uint8Array(ab);
  let s = "";
  // convert in chunks for performance
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) {
    const slice = u8.subarray(i, i + CH);
    s += String.fromCharCode.apply(null, Array.from(slice));
  }
  return s;
}

/* --------------------------- EXIF helpers --------------------------- */

/**
 * Convert various EXIF GPS tag shapes to {lat, lon} or null.
 * Accepts an 'expanded' tags object (ExifReader load with expanded:true) or a subset.
 */
export function gpsToDecimal(gps: any): LatLon {
  try {
    if (!gps) return null;

    // helper to get a value from multiple possible keys (case-sensitive and case-insensitive)
    const getFirst = (obj: any, keys: string[]) => {
      if (!obj) return undefined;
      for (const k of keys) {
        if (k in obj) return obj[k];
      }
      // case-insensitive fallback
      const lower = Object.keys(obj).reduce((acc: any, key) => { acc[key.toLowerCase()] = obj[key]; return acc; }, {});
      for (const k of keys) {
        const v = lower[k.toLowerCase()];
        if (typeof v !== "undefined") return v;
      }
      return undefined;
    };

    // parse possible rational objects, numbers, arrays, or strings
    const parseComponent = (v: any): number | null => {
      if (v == null) return null;

      // If it's already a number
      if (typeof v === "number" && isFinite(v)) return Number(v);

      // Some libraries give { value: 12.34 } or {numerator, denominator}
      if (typeof v === "object") {
        if ("value" in v && typeof v.value === "number") return Number(v.value);
        if ("numerator" in v && "denominator" in v && Number(v.denominator) !== 0) {
          return Number(v.numerator) / Number(v.denominator);
        }
        // exifreader sometimes gives { description: "41,6,56.1" } or { value: [..] }
        if (Array.isArray(v.value)) {
          // fall through to array handler below
          v = v.value;
        } else if (typeof v.description === "string" && v.description.includes(",")) {
          return parseDMSString(v.description);
        } else if (Array.isArray(v)) {
          return parseDMSArray(v);
        }
      }

      // If it's an array like [deg, min, sec]
      if (Array.isArray(v)) return parseDMSArray(v);

      // if it's a string like "41,6,56.1" or "41/1,6/1,561/10"
      if (typeof v === "string") {
        // trim, replace unicode commas, then try DMS
        const s = v.trim().replace(/\uFF0C/g, ",");
        if (s.includes(",") || s.includes("/")) return parseDMSString(s);
        // try parsing as decimal
        const n = Number(s);
        return isFinite(n) ? n : null;
      }

      return null;
    };

    const parseDMSArray = (arr: any[]): number | null => {
      try {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const nums = arr.map((x) => {
          if (typeof x === "number") return x;
          if (typeof x === "string") {
            const n = Number(x);
            if (isFinite(n)) return n;
            // "12/1" style
            if (x.includes("/")) {
              const [num, den] = x.split("/").map(Number);
              if (isFinite(num) && isFinite(den) && den !== 0) return num / den;
            }
          }
          // object like {numerator, denominator}
          if (typeof x === "object" && x !== null && "numerator" in x && "denominator" in x) {
            const num = Number(x.numerator), den = Number(x.denominator);
            if (isFinite(num) && isFinite(den) && den !== 0) return num / den;
          }
          return NaN;
        });
        const deg = Number(nums[0]) || 0;
        const min = Number(nums[1]) || 0;
        const sec = Number(nums[2]) || 0;
        if (!isFinite(deg)) return null;
        return deg + (min || 0) / 60 + (sec || 0) / 3600;
      } catch {
        return null;
      }
    };

    const parseDMSString = (s: string): number | null => {
      try {
        // some patterns: "41,6,56.1" or "41/1,6/1,561/10"
        const parts = s.split(",").map((p) => p.trim());
        if (parts.length === 1) {
          const n = Number(s);
          return isFinite(n) ? n : null;
        }
        const vals = parts.map((p) => {
          if (p.includes("/")) {
            const [num, den] = p.split("/").map(Number);
            if (isFinite(num) && isFinite(den) && den !== 0) return num / den;
            return NaN;
          }
          const n = Number(p);
          return isFinite(n) ? n : NaN;
        });
        return parseDMSArray(vals);
      } catch {
        return null;
      }
    };

    // find latitude / longitude and refs from many possible keys
    const latVals = getFirst(gps, ["GPSLatitude", "GPSLatitudeValue", "Latitude", "latitude", "lat", "gpsLatitude"]);
    const latRef = getFirst(gps, ["GPSLatitudeRef", "GPSLatitudeRefValue", "LatitudeRef", "latitudeRef", "latRef"]);
    const lonVals = getFirst(gps, ["GPSLongitude", "GPSLongitudeValue", "Longitude", "longitude", "lon", "lng", "gpsLongitude"]);
    const lonRef = getFirst(gps, ["GPSLongitudeRef", "GPSLongitudeRefValue", "LongitudeRef", "longitudeRef", "lonRef"]);

    // If there are also direct decimal fields 'latitude'/'longitude' as numbers, try those too (already covered by getFirst)
    if (typeof latVals === "undefined" && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      return { lat: Number(gps.latitude), lon: Number(gps.longitude) };
    }

    // parse components
    const latNum = parseComponent(latVals);
    const lonNum = parseComponent(lonVals);

    if (latNum == null || lonNum == null || !isFinite(latNum) || !isFinite(lonNum)) {
      // last attempt: some libs return keys 'Latitude' / 'Longitude' capitalized (common)
      const Lat = (gps as any).Latitude ?? (gps as any).Lat ?? (gps as any).GPSLatitude;
      const Lon = (gps as any).Longitude ?? (gps as any).Lon ?? (gps as any).GPSLongitude;
      if (typeof Lat === "number" && typeof Lon === "number") {
        const result = { lat: Number(Lat), lon: Number(Lon) };
        console.log("Parsed GPS (capital keys fallback):", result);
        return result;
      }

      // nothing parsed
      console.debug("gpsToDecimal: failed to parse components", { gps, latVals, lonVals, latRef, lonRef });
      return null;
    }

    // determine sign using ref if present, otherwise rely on numeric sign
    let latSign = 1;
    let lonSign = 1;
    const lRef = String(latRef ?? "").toUpperCase();
    const lnRef = String(lonRef ?? "").toUpperCase();
    if (lRef === "S" || lRef === "SOUTH" || lRef === "SO") latSign = -1;
    if (lnRef === "W" || lnRef === "WEST") lonSign = -1;

    // If no refs provided, respect negative numbers
    const finalLat = (latSign === -1 ? -Math.abs(latNum) : latNum);
    const finalLon = (lonSign === -1 ? -Math.abs(lonNum) : lonNum);

    const out = { lat: finalLat, lon: finalLon };
    console.log("Parsed GPS:", out, { rawGps: gps, latVals, lonVals, latRef, lonRef });
    return out;
  } catch (e) {
    console.warn("gpsToDecimal threw", e, { gps });
    return null;
  }
}


/**
 * Read full EXIF tags from a File or ArrayBuffer using exifreader (expanded).
 * Returns the tags object or null on failure.
 */
export async function readAllExifTags(fileOrArrayBuffer: File | Blob | ArrayBuffer): Promise<any | null> {
  if (typeof window === "undefined") return null;
  try {
    const mod = await import("exifreader");
    const ExifReader = (mod as any).default ?? mod;
    let ab: ArrayBuffer;
    if (fileOrArrayBuffer instanceof ArrayBuffer) {
      ab = fileOrArrayBuffer;
    } else {
      ab = await readFileAsArrayBuffer(fileOrArrayBuffer as File);
    }
    const tags = ExifReader.load(ab, { expanded: true });
    console.log('exif tags:', tags);

    return tags ?? null;
  } catch (e) {
    console.warn("readAllExifTags failed:", e);
    return null;
  }
}

/**
 * Extract EXIF (GPS) from a local File using exifreader.
 * Returns {lat, lon} or null.
 */
export async function extractExifFromFile(file: File): Promise<LatLon> {
  if (typeof window === "undefined") return null;
  try {
    const tags = await readAllExifTags(file);
    const gps = tags?.gps || tags;
    return gpsToDecimal(gps || {});
  } catch (e) {
    console.warn("extractExifFromFile failed:", e);
    return null;
  }
}

/* ----------------------- URL-based EXIF extraction (client) ----------------------- */

/**
 * Extract EXIF (GPS) from a remote image URL.
 * Note: often fails due to CORS; returns null on failure.
 */
export async function extractExifFromUrl(url: string, opts?: { mode?: RequestMode }): Promise<LatLon> {
  if (typeof window === "undefined") return null;
  try {
    const mode = opts?.mode ?? "cors";
    const resp = await fetch(url, { mode });
    if (!resp.ok) {
      console.warn("extractExifFromUrl fetch failed:", resp.status, resp.statusText);
      return null;
    }
    const ab = await resp.arrayBuffer();
    const tags = await readAllExifTags(ab);
    console.log('exif tags from url:', url, tags);
    const gps = tags?.gps || tags;
    console.log('gps from url:', gps);
    const decimalGPS = gpsToDecimal(gps || {});
    console.log('decimalGPS from url:', decimalGPS);

    return decimalGPS;
  } catch (e) {
    console.warn("extractExifFromUrl failed (maybe CORS):", e);
    return null;
  }
}

/**
 * extractExifFromUrlWithFallback
 * - Tries client-side fetch+parse first (CORS required).
 * - If that fails and serverProxyUrl is provided, calls the proxy endpoint which should return JSON { lat, lon }.
 * - serverProxyUrl usage: either GET ?url=<encoded-url> or POST with body { url } depending on server implementation.
 *
 * Returns { lat, lon } or null.
 */
export async function extractExifFromUrlWithFallback(
  url: string,
  opts?: {
    mode?: RequestMode;
    serverProxyUrl?: string;       // e.g. "/getImageExif" or full URL to your cloud function
    serverProxyMethod?: "GET" | "POST";
    serverProxyHeaders?: Record<string, string>;
    serverProxyBodyField?: string; // field name for the URL in POST (default "url")
  }
): Promise<LatLon> {
  // 1) try client-side (fast, zero-cost)
  const clientResult = await extractExifFromUrl(url, { mode: opts?.mode ?? "cors" });
  if (clientResult) return clientResult;

  // 2) fallback to server proxy if provided
  const proxy = opts?.serverProxyUrl;
  if (!proxy) return null;

  try {
    const method = opts?.serverProxyMethod ?? "GET";
    if (method === "GET") {
      // append encoded url param as ?url=
      const sep = proxy.includes("?") ? "&" : "?";
      const fetchUrl = `${proxy}${sep}url=${encodeURIComponent(url)}`;
      const r = await fetch(fetchUrl, { method: "GET", headers: opts?.serverProxyHeaders });
      if (!r.ok) throw new Error(`proxy GET failed: ${r.status}`);
      const json = await r.json();
      if (json && (json.lat != null && json.lon != null)) return { lat: Number(json.lat), lon: Number(json.lon) };
      return null;
    } else {
      // POST usage: send JSON body { url: ... } by default, but allow custom field name
      const bodyField = opts?.serverProxyBodyField ?? "url";
      const body = { [bodyField]: url };
      const r = await fetch(proxy, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(opts?.serverProxyHeaders ?? {}) },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`proxy POST failed: ${r.status}`);
      const json = await r.json();
      if (json && (json.lat != null && json.lon != null)) return { lat: Number(json.lat), lon: Number(json.lon) };
      return null;
    }
  } catch (e) {
    console.warn("extractExifFromUrlWithFallback proxy failed:", e);
    return null;
  }
}

/* --------------------------- HEIC conversion --------------------------- */

/**
 * convertHeicFile
 * - Uses heic-to (WASM) to convert HEIC/HEIF → JPEG or PNG
 * - If file is not HEIC, returns original file unchanged
 * - Never throws (safe for upload pipelines)
 */
export async function convertHeicFile(
  file: File,
  opts?: {
    type?: "image/jpeg" | "image/png";
    quality?: number; // JPEG only (0–1)
  }
): Promise<ConvertResult> {
  const type = opts?.type ?? "image/jpeg";
  const quality = opts?.quality ?? 0.85;

  if (typeof window === "undefined") {
    return { file, converted: false, reason: "SSR environment" };
  }

  try {
    const heic = await isHeic(file);
    if (!heic) {
      // Not HEIC — return original unchanged
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        converted: false,
        reason: "Not a HEIC/HEIF file",
      };
    }

    const blob = await heicTo({
      blob: file,
      type,
      quality,
    });

    const ext = type === "image/png" ? "png" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "");
    const outFile = new File([blob], `${base}.${ext}`, { type });

    return {
      file: outFile,
      previewUrl: URL.createObjectURL(outFile),
      converted: true,
    };
  } catch (e: any) {
    console.warn("HEIC conversion failed, returning original:", e);
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      converted: false,
      reason: String(e?.message ?? e),
    };
  }
}

/**
 * convertHeicFileToJpegFile
 * Attempts to convert HEIC/HEIF -> JPEG using multiple fallbacks:
 *  1) ImageDecoder (if available)
 *  2) createImageBitmap
 *  3) heic2any (dynamic import, requires package + WASM)
 * Returns ConvertResult (never throws; returns original file on failure with reason).
 */
export async function convertHeicFileToJpegFile(file: File): Promise<ConvertResult> {
  return await (convertHeicFile as any)(file, { type: "image/jpeg", quality: 0.92 });
}

/* --------------------------- EXIF copy & stripping --------------------------- */

/**
 * copyExifFromJpegToJpeg(originalJpegFile, newJpegBlob)
 * - Uses piexifjs to copy EXIF blocks from original -> new.
 * - Returns Blob (JPEG) with EXIF inserted. If piexif fails, returns newJpegBlob unchanged.
 */
export async function copyExifFromJpegToJpeg(originalJpegFile: File, newJpegBlob: Blob): Promise<Blob> {
  if (typeof window === "undefined") return newJpegBlob;
  try {
    const piexifMod = await import("piexifjs");
    const piexif = (piexifMod as any).default ?? piexifMod;

    const origBin = await readFileAsBinaryString(originalJpegFile);
    let exifObj: any;
    try {
      exifObj = piexif.load(origBin);
    } catch (e) {
      console.warn("piexif.load failed (no EXIF?):", e);
      exifObj = null;
    }
    if (!exifObj || Object.keys(exifObj).length === 0) {
      return newJpegBlob;
    }

    const newBin = await readFileAsBinaryString(newJpegBlob);
    try {
      const exifBytes = piexif.dump(exifObj);
      const patched = piexif.insert(exifBytes, newBin);
      // convert patched binary string back to Blob
      const len = patched.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) u8[i] = patched.charCodeAt(i) & 0xff;
      const outBlob = new Blob([u8], { type: "image/jpeg" });
      return outBlob;
    } catch (e) {
      console.warn("Failed to insert EXIF:", e);
      return newJpegBlob;
    }
  } catch (e) {
    console.warn("piexifjs not available or failed:", e);
    return newJpegBlob;
  }
}

/**
 * stripExifFromJpeg - remove EXIF from a JPEG Blob
 * Uses piexifjs to remove EXIF; returns Blob (JPEG) without EXIF.
 */
export async function stripExifFromJpeg(jpegFileOrBlob: File | Blob): Promise<Blob> {
  if (typeof window === "undefined") return jpegFileOrBlob;
  try {
    const piexifMod = await import("piexifjs");
    const piexif = (piexifMod as any).default ?? piexifMod;
    const bin = await readFileAsBinaryString(jpegFileOrBlob);
    try {
      const patched = piexif.remove(bin);
      const len = patched.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) u8[i] = patched.charCodeAt(i) & 0xff;
      return new Blob([u8], { type: "image/jpeg" });
    } catch (e) {
      console.warn("piexif.remove failed:", e);
      return jpegFileOrBlob;
    }
  } catch (e) {
    console.warn("piexifjs not available:", e);
    return jpegFileOrBlob;
  }
}

/* --------------------------- small helpers --------------------------- */

/** Make an object URL and return it */
export function makeObjectUrl(b: Blob): string {
  return URL.createObjectURL(b);
}

/** Revoke object URL */
export function revokeObjectUrl(url?: string | null) {
  try {
    if (url) URL.revokeObjectURL(url);
  } catch (e) { /* ignore */ }
}

/* --------------------------- Debug helpers --------------------------- */

/** returns true if any GPS-like tag exists on a File (client-side) */
export async function hasGpsExif(file: File): Promise<boolean> {
  try {
    const tags = await readAllExifTags(file);
    if (!tags) return false;
    const gps = tags?.gps || tags;
    return Boolean(gps.GPSLatitude || gps.GPSLatitudeRef || gps.GPSLongitude || gps.GPSLongitudeRef || gps.latitude || gps.longitude);
  } catch (e) {
    console.warn("hasGpsExif failed:", e);
    return false;
  }
}

/** Convenience: returns full tags (logged) and parsed lat/lon for debugging */
export async function debugExif(file: File): Promise<LatLon> {
  const tags = await readAllExifTags(file);
  console.log("EXIF tags for", file.name, tags);
  const gps = tags?.gps || tags;
  const ll = gpsToDecimal(gps || {});
  console.log("Parsed lat/lon:", ll);
  return ll;
}

/** Convert decimal degrees to DMS rational format used by piexifjs
 * returns array of three rationals: [[degNum,degDen],[minNum,minDen],[secNum,secDen]]
 */
function decimalToDMSRational(dec: number) {
  const abs = Math.abs(dec);
  const deg = Math.floor(abs);
  const minf = (abs - deg) * 60;
  const min = Math.floor(minf);
  const sec = (minf - min) * 60;
  // convert each to rational: we'll use denominator 1000000 for seconds to keep precision
  const degRat: [number, number] = [deg, 1];
  const minRat: [number, number] = [min, 1];
  const secDen = 1000000;
  const secRat: [number, number] = [Math.round(sec * secDen), secDen];
  return [degRat, minRat, secRat];
}

/**
 * Build a minimal GPS IFD object compatible with piexifjs
 * gps: { lat: number, lon: number, alt?: number }
 */
function buildGpsIfd(gps: { lat: number; lon: number; alt?: number } | null) {
  if (!gps) return {};
  const latRef = gps.lat < 0 ? "S" : "N";
  const lonRef = gps.lon < 0 ? "W" : "E";
  const lat = decimalToDMSRational(gps.lat);
  const lon = decimalToDMSRational(gps.lon);

  const gpsIfd: any = {
    // GPSLatitudeRef (1) and GPSLongitudeRef (3) are ASCII strings
    1: latRef,
    2: lat, // GPSLatitude as rationals
    3: lonRef,
    4: lon, // GPSLongitude as rationals
  };

  if (typeof gps.alt === "number" && !Number.isNaN(gps.alt)) {
    // GPSAltitudeRef = 0 (above sea level), GPSAltitude = rational
    const altAbs = Math.abs(gps.alt);
    gpsIfd[5] = 0; // GPSAltitudeRef
    gpsIfd[6] = [Math.round(altAbs * 100), 100]; // altitude rational with 2 decimal precision
  }

  // optionally, could add timestamp (GPSDateStamp / GPSTimeStamp) if you have it
  return gpsIfd;
}

/**
 * insertGpsExifIntoJpeg
 * - newJpegBlob: Blob (JPEG) to receive GPS EXIF
 * - gps: { lat, lon, alt? } (decimal degrees)
 * Returns a Blob (JPEG) with GPS EXIF inserted, or original blob on failure.
 *
 * Uses piexifjs in the browser (dynamic import). If piexifjs isn't available or fails, the function
 * returns the original blob (so upload can proceed).
 */
export async function insertGpsExifIntoJpeg(newJpegBlob: Blob, gps: { lat: number; lon: number; alt?: number } | null): Promise<Blob> {
  if (typeof window === "undefined") return newJpegBlob;
  if (!gps) return newJpegBlob;

  try {
    // dynamic import piexifjs
    const piexifMod = await import("piexifjs").catch(() => null);
    const piexif = (piexifMod as any)?.default ?? piexifMod;
    if (!piexif) {
      console.warn("insertGpsExifIntoJpeg: piexifjs not available");
      return newJpegBlob;
    }

    // read original JPEG binary string
    const newBin = await readFileAsBinaryString(newJpegBlob);

    // build EXIF structure: only GPS IFD (others empty)
    const gpsIfd = buildGpsIfd(gps);
    const exifObj: any = { "0th": {}, "Exif": {}, "GPS": gpsIfd, "Interop": {}, "1st": {}, "thumbnail": null };

    // dump and insert
    const exifBytes = piexif.dump(exifObj);
    const patched = piexif.insert(exifBytes, newBin);

    // convert patched binary string back to Blob
    const len = patched.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = patched.charCodeAt(i) & 0xff;
    return new Blob([u8], { type: "image/jpeg" });
  } catch (e) {
    console.warn("insertGpsExifIntoJpeg failed:", e);
    return newJpegBlob;
  }
}
