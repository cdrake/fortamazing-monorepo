// src/app/hikes/components/HeicConverterInput.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { LatLon } from "../lib/imageHelpers"; // adjust path if needed

export type ConvertedItem = {
  original: File;
  converted: Blob;
  previewUrl: string; // object URL for converted blob
  exif?: any; // raw exifreader tags if available
  gps?: LatLon | null;
  error?: string | null;
};

type Props = {
  multiple?: boolean;
  accept?: string;
  onConverted?: (items: ConvertedItem[]) => void;
  autoConvert?: boolean;
  className?: string;
};

/**
 * HeicConverterInput
 * - lets user pick HEIC/HEIF files
 * - converts each to JPEG using convertHeicToJpegPreserveExif (dynamically imported)
 * - extracts EXIF (exifreader) for GPS if available and returns converted blobs + preview urls
 *
 * Example:
 * <HeicConverterInput onConverted={(items)=> console.log(items)} />
 */
export default function HeicConverterInput({
  multiple = true,
  accept = "image/heic,image/heif,.heic,.heif",
  onConverted,
  autoConvert = true,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ idx: number; total: number } | null>(null);
  const [convertedItems, setConvertedItems] = useState<ConvertedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      convertedItems.forEach((it) => {
        try { URL.revokeObjectURL(it.previewUrl); } catch {}
      });
    };
  }, [convertedItems]);

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f instanceof File);
    setSelectedFiles(arr);
    setError(null);
    if (autoConvert && arr.length > 0) {
      // kick off conversion automatically
      // delay slightly so UI updates
      setTimeout(() => convertFiles(arr), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConvert]);

  const openPicker = useCallback(() => {
    if (inputRef.current) inputRef.current.click();
  }, []);

  // conversion worker: dynamic import of helpers inside function
  const convertFiles = useCallback(async (files: File[]) => {
  setConverting(true);
  setConvertedItems([]);
  setProgress({ idx: 0, total: files.length });
  setError(null);

  // dynamic import local helper module
  let helpers: any;
  try {
    helpers = await import("../lib/imageHelpers"); // path relative to component
  } catch (e) {
    console.error("Failed to import imageHelpers:", e);
    setError("Failed to load conversion helpers.");
    setConverting(false);
    return;
  }

  // handle multiple possible helper names
  const convertFn = helpers.convertHeicToJpegPreserveExif ?? helpers.convertHeicFileToJpegFile ?? helpers.convertHeicFileToJpeg ?? null;
  const extractExifFromFile = helpers.extractExifFromFile ?? null;
  const readAllExifTags = helpers.readAllExifTags ?? null;
  const gpsToDecimal = helpers.gpsToDecimal ?? helpers.gpsToDecimal ?? null;

  if (!convertFn) {
    console.warn("No convert function found in imageHelpers. Falling back to identity (no conversion).");
  }

  const results: ConvertedItem[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    setProgress({ idx: i + 1, total: files.length });
    try {
      // 1) Attempt to get **raw tags** (preferred) so we can store/display everything
      let rawTags: any = null;
      let gps: LatLon | null = null;

      // Try readAllExifTags (returns full tags) if available
      if (typeof readAllExifTags === "function") {
        try {
          rawTags = await readAllExifTags(file); // may be null
          if (rawTags) {
            // readAllExifTags returns expanded tags; some helpers put GPS under .gps or top-level
            const gpsContainer = rawTags?.gps ?? rawTags;
            gps = (typeof gpsToDecimal === "function") ? gpsToDecimal(gpsContainer || {}) : null;
          }
        } catch (e) {
          console.warn("readAllExifTags failed:", e);
          rawTags = null;
          gps = null;
        }
      }

      // 2) If we didn't get raw tags, try extractExifFromFile (might return LatLon directly)
      if ((!rawTags || !gps) && typeof extractExifFromFile === "function") {
        try {
          const maybeLatLon = await extractExifFromFile(file); // some implementations return {lat,lon} directly
          if (maybeLatLon && typeof maybeLatLon.lat === "number" && typeof maybeLatLon.lon === "number") {
            gps = maybeLatLon;
          } else if (!rawTags && typeof readAllExifTags !== "function") {
            // if extractExifFromFile returns tags in your version, set rawTags
            rawTags = maybeLatLon;
            const gpsContainer = rawTags?.gps ?? rawTags;
            gps = (typeof gpsToDecimal === "function") ? gpsToDecimal(gpsContainer || {}) : null;
          }
        } catch (e) {
          console.warn("extractExifFromFile failed:", e);
        }
      }

      // 3) Convert image (if conversion function available); otherwise use original file blob
      let convertedBlob: Blob;
      try {
        if (convertFn) {
          // some convert fns return File or Blob; normalize to Blob
          const out = await convertFn(file);
          convertedBlob = out instanceof Blob ? out : (out?.file ?? out);
          if (!(convertedBlob instanceof Blob)) {
            // if the convert function returns an object like { file, previewUrl }
            if (out?.file instanceof Blob) convertedBlob = out.file;
            else throw new Error("convert function returned unexpected shape");
          }
        } else {
          // no convert function — use original file as blob
          convertedBlob = file;
        }
      } catch (convErr: any) {
        console.warn("Conversion failed, using original file as fallback:", convErr);
        convertedBlob = file;
      }

      // 4) build preview URL
      const previewUrl = URL.createObjectURL(convertedBlob);

      const item: ConvertedItem = {
        original: file,
        converted: convertedBlob,
        previewUrl,
        exif: rawTags ?? null,
        gps: gps ?? null,
        error: null,
      };

      results.push(item);
      setConvertedItems((prev) => [...prev, item]);

      // small yield
      await new Promise((r) => setTimeout(r, 60));
    } catch (e: any) {
      console.error("Conversion failed for", file.name, e);
      const msg = e?.message ? String(e.message) : "Conversion failed";
      const failureItem: ConvertedItem = {
        original: file,
        converted: new Blob(),
        previewUrl: "",
        exif: null,
        gps: null,
        error: msg,
      };
      results.push(failureItem);
      setConvertedItems((prev) => [...prev, failureItem]);
    }
  }

  setProgress(null);
  setConverting(false);

  // notify parent
  setTimeout(() => {
    if (typeof onConverted === "function") onConverted(results);
  }, 0);
}, [onConverted]);


  // UI actions
  const handleConvertClick = useCallback(() => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setError("No files selected.");
      return;
    }
    convertFiles(selectedFiles);
  }, [selectedFiles, convertFiles]);

  const handleClear = useCallback(() => {
    // revoke previews
    convertedItems.forEach((it) => {
      try { URL.revokeObjectURL(it.previewUrl); } catch {}
    });
    setConvertedItems([]);
    setSelectedFiles([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [convertedItems]);

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={openPicker} className="px-3 py-1 border rounded">
          Choose HEIC files
        </button>

        <button
          type="button"
          onClick={handleConvertClick}
          disabled={converting || selectedFiles.length === 0}
          className="px-3 py-1 border rounded"
        >
          {converting ? "Converting…" : "Convert"}
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={converting && convertedItems.length === 0}
          className="px-3 py-1 border rounded"
        >
          Clear
        </button>

        <div style={{ marginLeft: "auto", fontSize: 13, color: "#666" }}>
          {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : "No files selected"}
        </div>
      </div>

      {progress && (
        <div style={{ marginTop: 8 }}>
          Converting {progress.idx}/{progress.total}…
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, color: "red" }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        {convertedItems.map((it, idx) => (
          <div key={`${it.original.name}-${idx}`} style={{ border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{it.original.name}</div>
            {it.error ? (
              <div style={{ color: "red", marginTop: 6 }}>Error: {it.error}</div>
            ) : (
              <>
                <div style={{ marginTop: 8, width: "100%", height: 120, overflow: "hidden", borderRadius: 6, background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {it.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.previewUrl} alt={it.original.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  ) : (
                    <div style={{ color: "#999" }}>No preview</div>
                  )}
                </div>

                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <a href={it.previewUrl} target="_blank" rel="noreferrer" className="px-2 py-1 border rounded text-sm">Open</a>
                  <a
                    href={it.previewUrl}
                    download={(it.original.name || "photo") + ".jpg"}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    Download
                  </a>
                  {it.gps ? (
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "#333" }}>
                      GPS: {it.gps.lat.toFixed(5)}, {it.gps.lon.toFixed(5)}
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
