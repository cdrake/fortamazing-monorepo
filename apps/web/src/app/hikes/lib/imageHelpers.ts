/**
 * imageHelper.ts
 * Utilities for image handling: reading, EXIF extraction, HEIC conversion, EXIF copying.
 */

import * as heicToModule from "heic-to";

type HeicToModule = {
  heicTo?: (opts: { blob: Blob; type?: string; quality?: number }) => Promise<Blob>;
  isHeic?: (f: File | Blob) => Promise<boolean>;
};

const { heicTo, isHeic } = (heicToModule as unknown) as HeicToModule;

export type LatLon = { lat: number; lon: number } | null;

export type ConvertResult = {
  file: File; // File to upload (converted or original)
  previewUrl?: string | null;
  converted: boolean; // whether we converted to JPEG
  reason?: string | null; // if not converted, why
};

export const isBlobLike = (v: unknown): v is Blob =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { arrayBuffer?: unknown }).arrayBuffer === "function" &&
  typeof (v as { size?: unknown }).size === "number" &&
  typeof (v as { type?: unknown }).type === "string";

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
  try {
    // FileReader.readAsBinaryString is deprecated in some environments; prefer fallback
    // But attempt it if present for performance.
    if (typeof FileReader !== "undefined" && (FileReader.prototype as any).readAsBinaryString) {
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error);
        fr.onload = () => resolve(String(fr.result));
        fr.readAsBinaryString(file);
      });
    }
  } catch {
    // fall through to ArrayBuffer path
  }

  const ab = await readFileAsArrayBuffer(file);
  const u8 = new Uint8Array(ab);
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) {
    const slice = u8.subarray(i, i + CH);
    s += String.fromCharCode.apply(null, Array.from(slice));
  }
  return s;
}

/* --------------------------- EXIF helpers --------------------------- */

function isNumber(val: unknown): val is number {
  return typeof val === "number" && isFinite(val);
}

/**
 * Convert various EXIF GPS tag shapes to {lat, lon} or null.
 * Accepts an 'expanded' tags object (ExifReader load with expanded:true) or a subset.
 */
export function gpsToDecimal(gps: unknown): LatLon {
  try {
    if (!gps || typeof gps !== "object") return null;

    const obj = gps as Record<string, unknown>;

    const getFirst = (o: Record<string, unknown> | undefined, keys: string[]) => {
      if (!o) return undefined;
      for (const k of keys) {
        if (k in o) return o[k];
      }
      // case-insensitive fallback
      const lower: Record<string, unknown> = {};
      for (const key of Object.keys(o)) lower[key.toLowerCase()] = o[key];
      for (const k of keys) {
        const v = lower[k.toLowerCase()];
        if (typeof v !== "undefined") return v;
      }
      return undefined;
    };

    const parseComponent = (v: unknown): number | null => {
      if (v == null) return null;

      if (isNumber(v)) return v as number;

      if (typeof v === "object" && v !== null) {
        const vObj = v as Record<string, unknown>;
        if (isNumber(vObj.value)) return Number(vObj.value);
        if ("numerator" in vObj && "denominator" in vObj) {
          const n = Number(vObj.numerator);
          const d = Number(vObj.denominator);
          if (isFinite(n) && isFinite(d) && d !== 0) return n / d;
        }
        if (Array.isArray(vObj.value)) {
          return parseDMSArray(vObj.value as unknown[]);
        }
        if (typeof vObj.description === "string" && vObj.description.includes(",")) {
          return parseDMSString(vObj.description);
        }
      }

      if (Array.isArray(v)) return parseDMSArray(v);
      if (typeof v === "string") {
        const s = v.trim().replace(/\uFF0C/g, ",");
        if (s.includes(",") || s.includes("/")) return parseDMSString(s);
        const n = Number(s);
        return isFinite(n) ? n : null;
      }

      return null;
    };

    const parseDMSArray = (arr: unknown[]): number | null => {
      try {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const nums = arr.map((x) => {
          if (isNumber(x)) return x as number;
          if (typeof x === "string") {
            const n = Number(x);
            if (isFinite(n)) return n;
            if (x.includes("/")) {
              const [numStr, denStr] = x.split("/");
              const num = Number(numStr);
              const den = Number(denStr);
              if (isFinite(num) && isFinite(den) && den !== 0) return num / den;
            }
          }
          if (typeof x === "object" && x !== null && "numerator" in (x as Record<string, unknown>) && "denominator" in (x as Record<string, unknown>)) {
            const num = Number((x as Record<string, unknown>).numerator);
            const den = Number((x as Record<string, unknown>).denominator);
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
        const parts = s.split(",").map((p) => p.trim());
        if (parts.length === 1) {
          const n = Number(s);
          return isFinite(n) ? n : null;
        }
        const vals = parts.map((p) => {
          if (p.includes("/")) {
            const [numStr, denStr] = p.split("/");
            const num = Number(numStr);
            const den = Number(denStr);
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

    const latVals = getFirst(obj, ["GPSLatitude", "GPSLatitudeValue", "Latitude", "latitude", "lat", "gpsLatitude"]);
    const latRef = getFirst(obj, ["GPSLatitudeRef", "GPSLatitudeRefValue", "LatitudeRef", "latitudeRef", "latRef"]);
    const lonVals = getFirst(obj, ["GPSLongitude", "GPSLongitudeValue", "Longitude", "longitude", "lon", "lng", "gpsLongitude"]);
    const lonRef = getFirst(obj, ["GPSLongitudeRef", "GPSLongitudeRefValue", "LongitudeRef", "longitudeRef", "lonRef"]);

    if (typeof (obj as Record<string, unknown>).latitude === "number" && typeof (obj as Record<string, unknown>).longitude === "number") {
      return { lat: Number((obj as Record<string, unknown>).latitude), lon: Number((obj as Record<string, unknown>).longitude) };
    }

    const latNum = parseComponent(latVals);
    const lonNum = parseComponent(lonVals);

    if (latNum == null || lonNum == null || !isFinite(latNum) || !isFinite(lonNum)) {
      // fallback checks for different keys
      const Lat = (obj as Record<string, unknown>).Latitude ?? (obj as Record<string, unknown>).Lat ?? (obj as Record<string, unknown>).GPSLatitude;
      const Lon = (obj as Record<string, unknown>).Longitude ?? (obj as Record<string, unknown>).Lon ?? (obj as Record<string, unknown>).GPSLongitude;
      if (typeof Lat === "number" && typeof Lon === "number") {
        return { lat: Number(Lat), lon: Number(Lon) };
      }
      return null;
    }

    let latSign = 1;
    let lonSign = 1;
    const lRef = String(latRef ?? "").toUpperCase();
    const lnRef = String(lonRef ?? "").toUpperCase();
    if (lRef === "S" || lRef === "SOUTH" || lRef === "SO") latSign = -1;
    if (lnRef === "W" || lnRef === "WEST") lonSign = -1;

    const finalLat = (latSign === -1 ? -Math.abs(latNum) : latNum);
    const finalLon = (lonSign === -1 ? -Math.abs(lonNum) : lonNum);

    return { lat: finalLat, lon: finalLon };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("gpsToDecimal threw", err, { gps });
    return null;
  }
}

/**
 * Read full EXIF tags from a File or ArrayBuffer using exifreader (expanded).
 * Returns the tags object or null on failure.
 */
export async function readAllExifTags(fileOrArrayBuffer: File | Blob | ArrayBuffer): Promise<Record<string, unknown> | null> {
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
    const tags = (ExifReader.load(ab, { expanded: true }) as Record<string, unknown>) ?? null;
    return tags;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("readAllExifTags failed:", err);
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
    const gps = (tags && ((tags as Record<string, unknown>).gps as unknown)) ?? tags;
    return gpsToDecimal(gps ?? {});
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("extractExifFromFile failed:", err);
    return null;
  }
}

/* ----------------------- URL-based EXIF extraction (client) ----------------------- */

export async function extractExifFromUrl(url: string, opts?: { mode?: RequestMode }): Promise<LatLon> {
  if (typeof window === "undefined") return null;
  try {
    const mode = opts?.mode ?? "cors";
    const resp = await fetch(url, { mode });
    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.warn("extractExifFromUrl fetch failed:", resp.status, resp.statusText);
      return null;
    }
    const ab = await resp.arrayBuffer();
    const tags = await readAllExifTags(ab);
    const gps = (tags && ((tags as Record<string, unknown>).gps as unknown)) ?? tags;
    return gpsToDecimal(gps ?? {});
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("extractExifFromUrl failed (maybe CORS):", err);
    return null;
  }
}

export async function extractExifFromUrlWithFallback(
  url: string,
  opts?: {
    mode?: RequestMode;
    serverProxyUrl?: string;
    serverProxyMethod?: "GET" | "POST";
    serverProxyHeaders?: Record<string, string>;
    serverProxyBodyField?: string;
  }
): Promise<LatLon> {
  const clientResult = await extractExifFromUrl(url, { mode: opts?.mode ?? "cors" });
  if (clientResult) return clientResult;

  const proxy = opts?.serverProxyUrl;
  if (!proxy) return null;

  try {
    const method = opts?.serverProxyMethod ?? "GET";
    if (method === "GET") {
      const sep = proxy.includes("?") ? "&" : "?";
      const fetchUrl = `${proxy}${sep}url=${encodeURIComponent(url)}`;
      const r = await fetch(fetchUrl, { method: "GET", headers: opts?.serverProxyHeaders });
      if (!r.ok) throw new Error(`proxy GET failed: ${r.status}`);
      const json = (await r.json()) as Record<string, unknown>;
      if (json && json.lat != null && json.lon != null) return { lat: Number(json.lat), lon: Number(json.lon) };
      return null;
    } else {
      const bodyField = opts?.serverProxyBodyField ?? "url";
      const body = { [bodyField]: url };
      const r = await fetch(opts!.serverProxyUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(opts?.serverProxyHeaders ?? {}) },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`proxy POST failed: ${r.status}`);
      const json = (await r.json()) as Record<string, unknown>;
      if (json && json.lat != null && json.lon != null) return { lat: Number(json.lat), lon: Number(json.lon) };
      return null;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("extractExifFromUrlWithFallback proxy failed:", err);
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
    quality?: number;
  }
): Promise<ConvertResult> {
  const type = opts?.type ?? "image/jpeg";
  const quality = opts?.quality ?? 0.85;

  if (typeof window === "undefined") {
    return { file, converted: false, reason: "SSR environment" };
  }

  try {
    const heicDetected = typeof isHeic === "function" ? await isHeic(file) : false;
    if (!heicDetected) {
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        converted: false,
        reason: "Not a HEIC/HEIF file",
      };
    }

    if (typeof heicTo !== "function") {
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        converted: false,
        reason: "heic-to not available",
      };
    }

    const blob = await heicTo({ blob: file, type, quality });
    const ext = type === "image/png" ? "png" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "");
    const outFile = new File([blob], `${base}.${ext}`, { type });

    return {
      file: outFile,
      previewUrl: URL.createObjectURL(outFile),
      converted: true,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("HEIC conversion failed, returning original:", err);
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      converted: false,
      reason: String((err as Error)?.message ?? err),
    };
  }
}

export async function convertHeicFileToJpegFile(file: File): Promise<ConvertResult> {
  return convertHeicFile(file, { type: "image/jpeg", quality: 0.92 });
}

/* --------------------------- EXIF copy & stripping --------------------------- */

export async function copyExifFromJpegToJpeg(originalJpegFile: File, newJpegBlob: Blob): Promise<Blob> {
  if (typeof window === "undefined") return newJpegBlob;
  try {
    const piexifMod = await import("piexifjs");
    const piexif = (piexifMod as any).default ?? piexifMod;

    const origBin = await readFileAsBinaryString(originalJpegFile);
    let exifObj: Record<string, unknown> | null = null;
    try {
      exifObj = piexif.load(origBin) as Record<string, unknown>;
    } catch {
      exifObj = null;
    }
    if (!exifObj || Object.keys(exifObj).length === 0) {
      return newJpegBlob;
    }

    const newBin = await readFileAsBinaryString(newJpegBlob);
    try {
      const exifBytes = piexif.dump(exifObj);
      const patched = piexif.insert(exifBytes, newBin);
      const len = patched.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) u8[i] = patched.charCodeAt(i) & 0xff;
      const outBlob = new Blob([u8], { type: "image/jpeg" });
      return outBlob;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Failed to insert EXIF:", err);
      return newJpegBlob;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("piexifjs not available or failed:", err);
    return newJpegBlob;
  }
}

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
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("piexif.remove failed:", err);
      return jpegFileOrBlob;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("piexifjs not available:", err);
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
  } catch {
    /* ignore */
  }
}

/* --------------------------- Debug helpers --------------------------- */

export async function hasGpsExif(file: File): Promise<boolean> {
  try {
    const tags = await readAllExifTags(file);
    if (!tags) return false;
    const gps = (tags as Record<string, unknown>).gps ?? tags;
    return Boolean(
      (gps as Record<string, unknown>).GPSLatitude ||
        (gps as Record<string, unknown>).GPSLatitudeRef ||
        (gps as Record<string, unknown>).GPSLongitude ||
        (gps as Record<string, unknown>).GPSLongitudeRef ||
        (gps as Record<string, unknown>).latitude ||
        (gps as Record<string, unknown>).longitude
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("hasGpsExif failed:", err);
    return false;
  }
}

export async function debugExif(file: File): Promise<LatLon> {
  const tags = await readAllExifTags(file);
  // eslint-disable-next-line no-console
  console.log("EXIF tags for", file.name, tags);
  const gps = (tags as Record<string, unknown>)?.gps ?? tags;
  const ll = gpsToDecimal(gps ?? {});
  // eslint-disable-next-line no-console
  console.log("Parsed lat/lon:", ll);
  return ll;
}

/* --------------------------- GPS insertion helpers --------------------------- */

function decimalToDMSRational(dec: number) {
  const abs = Math.abs(dec);
  const deg = Math.floor(abs);
  const minf = (abs - deg) * 60;
  const min = Math.floor(minf);
  const sec = (minf - min) * 60;
  const degRat: [number, number] = [deg, 1];
  const minRat: [number, number] = [min, 1];
  const secDen = 1000000;
  const secRat: [number, number] = [Math.round(sec * secDen), secDen];
  return [degRat, minRat, secRat] as [number, number][];
}

function buildGpsIfd(gps: { lat: number; lon: number; alt?: number } | null) {
  if (!gps) return {};
  const latRef = gps.lat < 0 ? "S" : "N";
  const lonRef = gps.lon < 0 ? "W" : "E";
  const lat = decimalToDMSRational(gps.lat);
  const lon = decimalToDMSRational(gps.lon);

  const gpsIfd: Record<number, unknown> = {
    1: latRef,
    2: lat,
    3: lonRef,
    4: lon,
  };

  if (typeof gps.alt === "number" && !Number.isNaN(gps.alt)) {
    const altAbs = Math.abs(gps.alt);
    gpsIfd[5] = 0;
    gpsIfd[6] = [Math.round(altAbs * 100), 100];
  }

  return gpsIfd;
}

export async function insertGpsExifIntoJpeg(newJpegBlob: Blob, gps: { lat: number; lon: number; alt?: number } | null): Promise<Blob> {
  if (typeof window === "undefined") return newJpegBlob;
  if (!gps) return newJpegBlob;

  try {
    const piexifMod = await import("piexifjs").catch(() => null);
    const piexif = (piexifMod as any)?.default ?? piexifMod;
    if (!piexif) {
      // eslint-disable-next-line no-console
      console.warn("insertGpsExifIntoJpeg: piexifjs not available");
      return newJpegBlob;
    }

    const newBin = await readFileAsBinaryString(newJpegBlob);
    const gpsIfd = buildGpsIfd(gps);
    const exifObj: Record<string, unknown> = { "0th": {}, Exif: {}, GPS: gpsIfd, Interop: {}, "1st": {}, thumbnail: null as unknown };

    const exifBytes = piexif.dump(exifObj);
    const patched = piexif.insert(exifBytes, newBin);
    const len = patched.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = patched.charCodeAt(i) & 0xff;
    return new Blob([u8], { type: "image/jpeg" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("insertGpsExifIntoJpeg failed:", err);
    return newJpegBlob;
  }
}
