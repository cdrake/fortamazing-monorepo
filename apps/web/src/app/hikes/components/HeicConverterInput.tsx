"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { LatLon } from "../lib/imageHelpers";

export type ConvertedItem = {
  original: File;
  converted: Blob;
  previewUrl: string; // object URL for converted blob
  exif?: Record<string, unknown> | null;
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

/** Types for the dynamic helpers module (best-effort) */
type ImageHelpers = {
  convertHeicToJpegPreserveExif?: (f: File) => Promise<File | Blob | { file?: File | Blob } | null>;
  convertHeicFileToJpegFile?: (f: File) => Promise<File | Blob | { file?: File | Blob } | null>;
  convertHeicFileToJpeg?: (f: File) => Promise<File | Blob | { file?: File | Blob } | null>;
  extractExifFromFile?: (f: File) => Promise<Record<string, unknown> | LatLon | null>;
  readAllExifTags?: (f: File) => Promise<Record<string, unknown> | null>;
  gpsToDecimal?: (gpsContainer: unknown) => LatLon | null;
  // other helpers possibly present...
};

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
        try {
          URL.revokeObjectURL(it.previewUrl);
        } catch {
          /* ignore */
        }
      });
    };
  }, [convertedItems]);

  const handleFilesSelected = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const arr = Array.from(files).filter((f): f is File => f instanceof File);
      setSelectedFiles(arr);
      setError(null);
      if (autoConvert && arr.length > 0) {
        // kick off conversion automatically (allow UI to update)
        setTimeout(() => convertFiles(arr), 50);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [autoConvert]
  );

  const openPicker = useCallback(() => {
    if (inputRef.current) inputRef.current.click();
  }, []);

  // conversion worker: dynamic import of helpers inside function
  const convertFiles = useCallback(
    async (files: File[]) => {
      setConverting(true);
      setConvertedItems([]);
      setProgress({ idx: 0, total: files.length });
      setError(null);

      // dynamic import local helper module
      let helpersModule: ImageHelpers | null = null;
      try {
        // dynamic import path relative to component
        const mod = await import("../lib/imageHelpers");
        helpersModule = (mod as unknown) as ImageHelpers;
      } catch (_err) {
        // eslint-disable-next-line no-console
        console.error("Failed to import imageHelpers:", _err);
        setError("Failed to load conversion helpers.");
        setConverting(false);
        return;
      }

      const convertFn =
        helpersModule.convertHeicToJpegPreserveExif ??
        helpersModule.convertHeicFileToJpegFile ??
        helpersModule.convertHeicFileToJpeg ??
        null;
      const extractExifFromFile = helpersModule.extractExifFromFile ?? null;
      const readAllExifTags = helpersModule.readAllExifTags ?? null;
      const gpsToDecimal = helpersModule.gpsToDecimal ?? null;

      if (!convertFn) {
        // eslint-disable-next-line no-console
        console.warn("No convert function found in imageHelpers. Falling back to identity (no conversion).");
      }

      const results: ConvertedItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ idx: i + 1, total: files.length });

        try {
          // 1) Attempt to get raw EXIF tags and GPS
          let rawTags: Record<string, unknown> | null = null;
          let gps: LatLon | null = null;

          if (typeof readAllExifTags === "function") {
            try {
              const t = await readAllExifTags(file);
              if (t && typeof t === "object") {
                rawTags = t as Record<string, unknown>;
                // Some implementations nest GPS; try both
                const gpsContainer = (rawTags as any).gps ?? rawTags; // minimal narrowing for lookup
                if (typeof gpsToDecimal === "function") {
                  gps = gpsToDecimal(gpsContainer);
                }
              }
            } catch (_readErr) {
              // eslint-disable-next-line no-console
              console.warn("readAllExifTags failed:", _readErr);
              rawTags = null;
              gps = null;
            }
          }

          if ((!rawTags || !gps) && typeof extractExifFromFile === "function") {
            try {
              const maybe = await extractExifFromFile(file);
             
              if (maybe !== null) {
                gps = maybe as LatLon;
              } else if (!rawTags && maybe && typeof maybe === "object") {
                rawTags = maybe as Record<string, unknown>;
                const gpsContainer = (rawTags as any).gps ?? rawTags;
                if (typeof gpsToDecimal === "function") gps = gpsToDecimal(gpsContainer);
              }
            } catch (_exifErr) {
              // eslint-disable-next-line no-console
              console.warn("extractExifFromFile failed:", _exifErr);
            }
          }

          // 3) Convert image (if conversion function available); otherwise use original file blob
          let convertedBlob: Blob;
          try {
            if (convertFn) {
              const out = await convertFn(file);
              // Normalize possible shapes: File | Blob | { file: Blob | File } | null
              if (out instanceof Blob) {
                convertedBlob = out;
              } else if (out && typeof out === "object" && (out as { file?: unknown }).file instanceof Blob) {
                convertedBlob = (out as { file: Blob }).file;
              } else if (out && typeof out === "object" && (out as { file?: unknown }).file instanceof File) {
                convertedBlob = (out as { file: File }).file;
              } else if (out instanceof File) {
                convertedBlob = out;
              } else {
                throw new Error("convert function returned unexpected shape");
              }
            } else {
              convertedBlob = file;
            }
          } catch (_convErr) {
            // eslint-disable-next-line no-console
            console.warn("Conversion failed, using original file as fallback:", _convErr);
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

          // small yield so UI updates
          // eslint-disable-next-line @typescript-eslint/await-thenable
          await new Promise((r) => setTimeout(r, 60));
        } catch (_err) {
          // top-level per-file failure (shouldn't usually happen)
          // eslint-disable-next-line no-console
          console.error("Conversion failed for", file.name, _err);
          const msg = (_err && ((_err as Error).message || String(_err))) ?? "Conversion failed";
          const failureItem: ConvertedItem = {
            original: file,
            converted: new Blob(),
            previewUrl: "",
            exif: null,
            gps: null,
            error: String(msg),
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
    },
    [onConverted]
  );

  // UI actions
  const handleConvertClick = useCallback(() => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setError("No files selected.");
      return;
    }
    void convertFiles(selectedFiles);
  }, [selectedFiles, convertFiles]);

  const handleClear = useCallback(() => {
    // revoke previews
    convertedItems.forEach((it) => {
      try {
        URL.revokeObjectURL(it.previewUrl);
      } catch {
        /* ignore */
      }
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
        <div style={{ marginTop: 8 }}>Converting {progress.idx}/{progress.total}…</div>
      )}

      {error && <div style={{ marginTop: 8, color: "red" }}>{error}</div>}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        {convertedItems.map((it, idx) => (
          <div key={`${it.original.name}-${idx}`} style={{ border: "1px solid #eee", padding: 8, borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{it.original.name}</div>
            {it.error ? (
              <div style={{ color: "red", marginTop: 6 }}>Error: {it.error}</div>
            ) : (
              <>
                <div
                  style={{
                    marginTop: 8,
                    width: "100%",
                    height: 120,
                    overflow: "hidden",
                    borderRadius: 6,
                    background: "#fafafa",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {it.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.previewUrl} alt={it.original.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  ) : (
                    <div style={{ color: "#999" }}>No preview</div>
                  )}
                </div>

                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <a href={it.previewUrl} target="_blank" rel="noreferrer" className="px-2 py-1 border rounded text-sm">
                    Open
                  </a>
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
