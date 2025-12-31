"use client";

import React, { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Geometry, Position } from "geojson";
import * as turf from "@turf/turf";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";
import { db } from "@/lib/firebase";
import MapView, { ImageMarker } from "./MapView";
import { appendToHikeWithStorage } from "../lib/hikeEditor";
import { gpx as parseGpx, kml as parseKml } from "togeojson";
import { convertHeicFile, extractExifFromFile, extractExifFromUrl, insertGpsExifIntoJpeg, isBlobLike, LatLon } from "../lib/imageHelpers"; // optional helper
import LightboxGallery from "./LightboxGallery";
import { getCombinedExtentFromDayTracks } from "../lib/trackUtils";
import ElevationHistogram from "./ElevationHistogram";

type TrackDetailProps = {
  registerLoad?: (fn: (hikeId: string) => Promise<void>) => (() => void) | void;
};

type DayTrack = {
  id: string;
  name: string;
  geojson: FeatureCollection<Geometry>;
  stats: { distance_m: number; elevation: { min:number; max:number } | null; bounds: [number,number,number,number] | null };
  color?: string;
  visible?: boolean;
};

export default function TrackDetail({ registerLoad }: TrackDetailProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hikeId, setHikeId] = useState<string | null>(null);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [descriptionMd, setDescriptionMd] = useState<string>("");

  const [dayTracks, setDayTracks] = useState<DayTrack[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [combinedGeojson, setCombinedGeojson] = useState<FeatureCollection<Geometry> | null>(null);

  // edit UI state
  const [isEdit, setIsEdit] = useState(false);
  const [newGpxFiles, setNewGpxFiles] = useState<File[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [savingEdits, setSavingEdits] = useState(false);

  // active segment/day selection (index into dayTracks)
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  // elevation profile for active segment: { dist_m, elev }
  const [activeSegmentProfile, setActiveSegmentProfile] = useState<{ dist_m: number; elev: number }[] | null>(null);
  
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);

  const [imageMarkers, setImageMarkers] = useState<ImageMarker[]>([]);
  const [selectedElevations, setSelectedElevations] = useState<number[] | null>(null);

  // expose load to parent via registerLoad
  useEffect(() => {
    if (typeof registerLoad !== "function") return;
    const unregister = registerLoad(loadHike);
    return () => {
      try { if (typeof unregister === "function") unregister(); } catch (e) { /* ignore */ }
    };
  }, [registerLoad, loadHike]);

  // --------------------
  // Load hike doc & assets
  // --------------------
  async function loadHike(id: string) {
    setLoading(true);
    setError(null);
    setHikeId(null);
    try {
      const authUser = getAuth().currentUser;
      if (!authUser) throw new Error("Sign in required to load hikes");

      const docRef = doc(db, "users", authUser.uid, "hikes", id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error("Hike not found under current user");

      const data: any = snap.data();

      setHikeId(id);
      setOwnerUid(authUser.uid);
      setTitle(data.title ?? "");
      setDescriptionMd(data.descriptionMd ?? "");

      // load days (support inline geojson or geojsonUrl / geojsonPath / combinedUrl)
      const loadedDays: DayTrack[] = [];
      if (Array.isArray(data.days) && data.days.length) {
        const storage = getStorage();
        for (let i = 0; i < data.days.length; i++) {
          const d = data.days[i];
          let fc: FeatureCollection<Geometry> = { type: "FeatureCollection", features: [] };
          if (d.geojson) {
            fc = d.geojson;
          } else if (d.geojsonUrl) {
            try {
              const resp = await fetch(d.geojsonUrl);
              fc = await resp.json();
            } catch (e) {
              // ignore
            }
          } else if (d.geojsonPath) {
            try {
              const path = typeof d.geojsonPath === "string" ? d.geojsonPath : "";
              if (path.startsWith("gs://")) {
                const ref = storageRef(storage, path.replace(/^gs:\/\//, ""));
                const dl = await getDownloadURL(ref);
                const resp = await fetch(dl);
                fc = await resp.json();
              } else {
                const resp = await fetch(path);
                fc = await resp.json();
              }
            } catch (e) {
              // ignore
            }
          } else {
            fc = { type: "FeatureCollection", features: [] };
          }

          const stats = computeStats(fc);
          loadedDays.push({
            id: d.id ?? `day-${i}`,
            name: d.name ?? `Day ${i + 1}`,
            geojson: fc,
            stats,
            color: d.color ?? undefined,
            visible: typeof d.visible === "boolean" ? d.visible : true,
          });
        }
      } else {
        // try combined
        let combined: FeatureCollection<Geometry> | null = null;
        try {
          if (data.combinedGeojson) combined = data.combinedGeojson;
          else if (data.combinedUrl) {
            const storage = getStorage();
            let url = data.combinedUrl;
            if (typeof url === "string" && url.startsWith("gs://")) {
              const ref = storageRef(storage, url.replace(/^gs:\/\//, ""));
              url = await getDownloadURL(ref);
            }
            const resp = await fetch(url);
            combined = await resp.json();
          }
        } catch (e) {
          // ignore
        }
        if (combined) {
          combined.features.forEach((feat: any, idx: number) => {
            const single: FeatureCollection<Geometry> = { type: "FeatureCollection", features: [feat] };
            const stats = computeStats(single);
            loadedDays.push({
              id: `${id}-feat-${idx}`,
              name: `Part ${idx + 1}`,
              geojson: single,
              stats,
              color: undefined,
              visible: true,
            });
          });
        }
      }

      setDayTracks(loadedDays);
      setCombinedGeojson({ type: "FeatureCollection", features: loadedDays.flatMap(d => d.geojson.features) });

      // resolve images
      const resolvedImages: string[] = [];
      if (Array.isArray(data.images)) {
        const storage = getStorage();
        for (const im of data.images) {
          try {
            const maybe = im.url ?? im.path ?? im;
            if (typeof maybe === "string" && maybe.startsWith("gs://")) {
              const ref = storageRef(storage, maybe.replace(/^gs:\/\//, ""));
              const dl = await getDownloadURL(ref);
              resolvedImages.push(dl);
            } else if (typeof maybe === "string") {
              resolvedImages.push(maybe);
            }
          } catch (e) {
            // ignore per-image error
          }
        }
      }
      setImages(resolvedImages);

      // reset active day/segment
      if (loadedDays.length) {
        setActiveDayIndex(0);
        const profile0 = computeProfileFromGeojson(loadedDays[0].geojson);
        setActiveSegmentProfile(profile0.length ? profile0 : null);
        setSelectedElevations(profile0.length ? profile0.map(p => p.elev) : null);
      } else {
        setActiveDayIndex(null);
        setActiveSegmentProfile(null);
        setSelectedElevations(null);
      }

      // derive image markers (try EXIF and place inside bbox)
      const markers: ImageMarker[] = [];
      try {
        const ext = getCombinedExtentFromDayTracks(loadedDays);
        const bbox = ext?.bbox ?? null;
        for (let i = 0; i < resolvedImages.length; i++) {
          const url = resolvedImages[i];
          try {
            const gps = await extractExifFromUrl(url);
            if (!gps) continue;
            if (bbox) {
              const [minLon, minLat, maxLon, maxLat] = bbox;
              if (!(gps.lon >= minLon && gps.lon <= maxLon && gps.lat >= minLat && gps.lat <= maxLat)) {
                continue;
              }
            }
            markers.push({ lat: gps.lat, lon: gps.lon, url, title: `Photo ${i+1}`, previewSize: 140 });
          } catch (e) {
            // ignore per-image failure
          }
        }
      } catch (e) {
        // ignore overall marker derivation errors
      }
      setImageMarkers(markers);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  // --------------------
  // Stats / elevation profile helpers
  // --------------------
  function computeStats(fc: FeatureCollection<Geometry>) {
    let total = 0;
    const elev: number[] = [];
    try {
      for (const f of fc.features) {
        try { total += turf.length(f as any, { units: "kilometers" }) * 1000; } catch {}
        const g: any = f.geometry;
        if (!g) continue;
        const coords: Position[] = [];
        if (g.type === "LineString") coords.push(...(g.coordinates as Position[]));
        else if (g.type === "MultiLineString") coords.push(...((g.coordinates as Position[][]).flat()));
        for (const p of coords) if (p && p.length > 2 && typeof p[2] === "number") elev.push(p[2]);
      }
    } catch (e) {}
    let bounds: [number, number, number, number] | null = null;
    try { bounds = turf.bbox(fc) as [number, number, number, number]; } catch { bounds = null; }
    return { distance_m: Math.round(total), elevation: elev.length ? { min: Math.min(...elev), max: Math.max(...elev) } : null, bounds };
  }

  // Extract elevation profile (distances in meters) from a day's geojson features
  function computeProfileFromGeojson(fc: FeatureCollection<Geometry>): { dist_m: number; elev: number }[] {
    // We'll process all LineString coordinates in order and build cumulative distance + elevation points.
    const points: { lat: number; lon: number; elev?: number }[] = [];
    for (const f of fc.features) {
      const g: any = f.geometry;
      if (!g) continue;
      if (g.type === "LineString") {
        for (const c of g.coordinates as Position[]) {
          points.push({ lon: c[0], lat: c[1], elev: typeof c[2] === "number" ? c[2] : NaN });
        }
      } else if (g.type === "MultiLineString") {
        for (const line of (g.coordinates as Position[][])) {
          for (const c of line) points.push({ lon: c[0], lat: c[1], elev: typeof c[2] === "number" ? c[2] : NaN });
        }
      } else if (g.type === "Point") {
        const c = g.coordinates as Position;
        points.push({ lon: c[0], lat: c[1], elev: typeof c[2] === "number" ? c[2] : NaN });
      }
    }

    if (points.length === 0) return [];

    const profile: { dist_m: number; elev: number }[] = [];
    let acc = 0;
    let last = points[0];
    if (typeof last.elev !== "number" || Number.isNaN(last.elev)) last.elev = 0;
    profile.push({ dist_m: 0, elev: last.elev ?? 0 });

    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const from = turf.point([last.lon, last.lat]);
      const to = turf.point([p.lon, p.lat]);
      let d = 0;
      try { d = turf.distance(from, to, { units: "kilometers" }) * 1000; } catch { d = 0; }
      acc += d;
      const elev = (typeof p.elev === "number" && !Number.isNaN(p.elev)) ? p.elev : (profile.length ? profile[profile.length - 1].elev : 0);
      profile.push({ dist_m: Math.round(acc), elev });
      last = p;
    }
    return profile;
  }

  // compute + set profile for specific day index (also set selectedElevations for histogram)
  const computeAndSetProfileForDay = useCallback((dayIndex: number, daysParam?: DayTrack[]) => {
    const days = daysParam ?? dayTracks;
    if (!days || !days[dayIndex]) {
      setActiveSegmentProfile(null);
      setSelectedElevations(null);
      return;
    }
    const fc = days[dayIndex].geojson;
    const profile = computeProfileFromGeojson(fc);
    setActiveSegmentProfile(profile.length ? profile : null);
    setSelectedElevations(profile.length ? profile.map(p => p.elev) : null);
    // return profile in case caller wants it
    return profile;
  }, [dayTracks]);

  // when user selects a day in sidebar
  const onSelectDay = useCallback((idx: number) => {
    setActiveDayIndex(idx);
    computeAndSetProfileForDay(idx);
    // optionally, scroll or do other UI updates
  }, [computeAndSetProfileForDay]);

  // --------------------
  // Edit form handlers (append GPX/KML + images)
  // --------------------
  const onGpxFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const arr = Array.from(e.target.files);
    setNewGpxFiles(prev => prev.concat(arr));
    e.target.value = "";
  }, []);

  const onImageFilesChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files) return;
  const arr = Array.from(e.target.files);

  // We'll produce finalFiles (File[]) and previews (string[])
  const finalFiles: File[] = [];
  const previews: string[] = [];

  for (let i = 0; i < arr.length; i++) {
    const f = arr[i];
    try {
      // 1) Try to read GPS EXIF from the original file (best-effort)
      let gps: LatLon = null;
      try {
        gps = await extractExifFromFile(f);
        console.debug("[onImageFilesChange] extracted gps from original", { name: f.name, gps });
      } catch (exifErr) {
        console.warn("[onImageFilesChange] extractExifFromFile failed for", f.name, exifErr);
        gps = null;
      }

      const ext = (f.name.split(".").pop() || "").toLowerCase();
      if ((ext === "heic" || ext === "heif") && typeof convertHeicFile === "function") {
        // 2) HEIC -> JPEG conversion + inject GPS EXIF (if available)
        try {
          const conv: any = await convertHeicFile(f, { type: "image/jpeg", quality: 0.92 });
          const out = conv?.file ?? conv;
          // normalize to Blob
          let outBlob: Blob | null = null;
          if (out instanceof Blob) outBlob = out;
          else if (isBlobLike(out)) outBlob = out as unknown as Blob;
          else if (out && typeof out.arrayBuffer === "function") outBlob = out as Blob;
          else throw new Error("HEIC converter returned unsupported value");

          // insert GPS EXIF into the converted JPEG (best-effort)
          let patchedBlob: Blob = outBlob;
          try {
            patchedBlob = await insertGpsExifIntoJpeg(outBlob, gps && typeof gps.lat === "number" && typeof gps.lon === "number" ? gps : null);
          } catch (insertErr) {
            console.warn("[onImageFilesChange] insertGpsExifIntoJpeg failed, using converted blob", insertErr);
            patchedBlob = outBlob;
          }

          // normalize to File
          const filenameBase = (f.name || "image").replace(/\.[^.]+$/, "");
          const finalFile = patchedBlob instanceof File ? patchedBlob : new File([patchedBlob], `${filenameBase}.jpg`, { type: "image/jpeg" });

          finalFiles.push(finalFile);
          try { previews.push(URL.createObjectURL(finalFile)); } catch { previews.push(""); }
        } catch (convErr) {
          console.warn("[onImageFilesChange] HEIC conversion or EXIF insert failed, falling back to original", convErr);
          finalFiles.push(f);
          try { previews.push(URL.createObjectURL(f)); } catch { previews.push(""); }
        }
      } else {
        // not HEIC — keep original file (may already contain EXIF)
        finalFiles.push(f);
        try { previews.push(URL.createObjectURL(f)); } catch { previews.push(""); }
      }
    } catch (err) {
      console.warn("[onImageFilesChange] per-file error", err);
      // fallback: include original file but still continue processing others
      finalFiles.push(f);
      try { previews.push(URL.createObjectURL(f)); } catch { previews.push(""); }
    }
  }

  // append previews and new files to state
  setImagePreviews(prev => prev.concat(previews));
  setNewImageFiles(prev => prev.concat(finalFiles));

  // clear native input to allow re-selecting the same files
  e.target.value = "";
}, [setImagePreviews, setNewImageFiles]);


  const saveEdits = useCallback(async () => {
    if (!hikeId) return alert("No hike loaded");
    const authUser = getAuth().currentUser;
    if (!authUser) return alert("Sign in to save edits");
    if (newGpxFiles.length === 0 && newImageFiles.length === 0) return alert("Nothing to save");

    setSavingEdits(true);
    try {
      // parse new gpx/kml into inline dayTracks
      const dayTracksToAppend: any[] = [];
      for (let i = 0; i < newGpxFiles.length; i++) {
        const f = newGpxFiles[i];
        try {
          const text = await f.text();
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, "text/xml");
          let gjson: FeatureCollection<Geometry>;
          const ext = (f.name.split(".").pop() || "").toLowerCase();
          if (ext === "gpx") gjson = parseGpx(xml);
          else if (ext === "kml") gjson = parseKml(xml);
          else {
            if (text.trim().startsWith("<")) gjson = parseGpx(xml);
            else throw new Error("Unsupported");
          }

          const feats = gjson.features || [];
          if (feats.length > 1) {
            for (let fi = 0; fi < feats.length; fi++) {
              const single: FeatureCollection<Geometry> = { type: "FeatureCollection", features: [feats[fi]] };
              dayTracksToAppend.push({ id: `append-${Date.now()}-${i}-${fi}`, name: `${f.name} (part ${fi+1})`, geojson: single, stats: computeStats(single) });
            }
          } else {
            dayTracksToAppend.push({ id: `append-${Date.now()}-${i}`, name: f.name, geojson: gjson, stats: computeStats(gjson) });
          }
        } catch (e) {
          // ignore parse error for this file
        }
      }

      // convert HEIC images if possible (best-effort)
      const finalImageFiles: File[] = [];
      for (let i = 0; i < newImageFiles.length; i++) {
        const f = newImageFiles[i];
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        if ((ext === "heic" || ext === "heif") && typeof convertHeicFile === "function") {
          try {
            const conv: any = await convertHeicFile(f, { type: "image/jpeg", quality: 0.92 });
            const out = conv?.file ?? conv;
            if (out instanceof File) finalImageFiles.push(out);
            else if (out instanceof Blob) finalImageFiles.push(new File([out], `${f.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" }));
            else finalImageFiles.push(f);
          } catch (e) {
            finalImageFiles.push(f);
          }
        } else {
          finalImageFiles.push(f);
        }
      }

      // append via shared helper
      await appendToHikeWithStorage({
        hikeId,
        dayTracks: dayTracksToAppend,
        imageFiles: finalImageFiles,
        storeDownloadUrls: true,
      });

      // reload
      await loadHike(hikeId);

      // clear edit buffers
      setNewGpxFiles([]);
      setNewImageFiles([]);
      imagePreviews.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
      setImagePreviews([]);
      setIsEdit(false);
      alert("Edits appended.");
    } catch (err: any) {
      console.error("saveEdits error", err);
      alert("Save failed: " + String(err?.message ?? err));
    } finally {
      setSavingEdits(false);
    }
  }, [hikeId, newGpxFiles, newImageFiles, imagePreviews]);

  // cleanup previews on unmount
  useEffect(() => {
    return () => {
      imagePreviews.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    };
  }, [imagePreviews]);

  // --------------------
  // Render
  // --------------------
  return (
    <div className="w-full max-w-6xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold">{title || "Hike detail"}</h2>
          {hikeId && <div className="text-xs text-gray-500">id: {hikeId}</div>}
        </div>

        <div className="flex gap-2">
          {getAuth().currentUser?.uid === ownerUid ? (
            <>
              <button className="px-2 py-1 border rounded" onClick={() => setIsEdit(s => !s)}>
                {isEdit ? "Cancel edit" : "Edit"}
              </button>
              {isEdit && (
                <button
                  className="px-2 py-1 border rounded bg-sky-50"
                  onClick={saveEdits}
                  disabled={savingEdits || (newGpxFiles.length === 0 && newImageFiles.length === 0)}
                >
                  {savingEdits ? "Saving…" : "Save edits"}
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div style={{ height: 420, borderRadius: 6, overflow: "hidden", border: "1px solid #eee" }}>
            <MapView
              dayTracks={dayTracks}
              activeTrackId={dayTracks?.[activeDayIndex ?? -1]?.id}
              onTrackClick={(trackId: string) => {
                // find index and set active day + compute profile
                const idx = dayTracks.findIndex((t) => t.id === trackId);
                if (idx >= 0) {
                  setActiveDayIndex(idx);
                  computeAndSetProfileForDay(idx);
                }
              }}
              combinedGeojson={combinedGeojson ?? undefined}
              imageMarkers={imageMarkers}
              activeTileId="osm"
              onMapApiReady={() => {}}
              tileLayers={[{ id: "osm", name: "OSM", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" }]}
              onFeatureClick={({ elevations }) => {
                if (elevations && elevations.length > 0) {
                  setSelectedElevations(elevations);
                } else {
                  setSelectedElevations(null);
                }
              }}
            />
          </div>

          {/* elevation profile preview (data available for next step rendering) */}
          <div className="mt-3">
            <strong>Active segment profile</strong>
            {activeSegmentProfile ? (
              <div className="text-sm text-gray-700 mt-2">
                <div>Points: {activeSegmentProfile.length}</div>
                <div>Distance: {(activeSegmentProfile[activeSegmentProfile.length - 1].dist_m / 1000).toFixed(2)} km</div>
                <div>Elevation range: {Math.round(Math.min(...activeSegmentProfile.map(p => p.elev)))}–{Math.round(Math.max(...activeSegmentProfile.map(p => p.elev)))} m</div>

                {/* Inline histogram for the selected segment */}
                {selectedElevations && selectedElevations.length > 0 ? (
                  <div className="mt-3">
                    <ElevationHistogram
                      elevations={selectedElevations}
                      bins={40}
                      title="Segment elevation"
                    />
                    <div className="mt-2">
                      <button className="px-2 py-1 border rounded text-sm" onClick={() => setSelectedElevations(null)}>Hide elevation</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 mt-2">No elevation data available for this segment.</div>
                )}

              </div>
            ) : (
              <div className="text-sm text-gray-600 mt-2">No active segment selected.</div>
            )}
          </div>

          {isEdit && (
            <div className="mt-4 p-3 border rounded bg-gray-50">
              <div className="mb-2 font-semibold">Add GPX / KML files</div>
              <input type="file" accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml" multiple onChange={onGpxFilesChange} />
              <div className="mt-2 text-sm text-gray-600">{newGpxFiles.length} file(s) queued</div>

              <div className="mt-4 mb-2 font-semibold">Add photos</div>
              <input type="file" accept="image/*" multiple onChange={onImageFilesChange} />
              <div className="mt-2 flex gap-2 flex-wrap">
                {imagePreviews.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`preview-${i}`} className="w-24 h-16 object-cover rounded" />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside>
          <div className="mb-3">
            <strong>Tracks</strong>
            <div className="mt-2 flex flex-col gap-2">
              {dayTracks.length === 0 && <div className="text-sm text-gray-600">No tracks loaded</div>}
              {dayTracks.map((d, idx) => (
                <button
                  key={d.id}
                  className={`text-left p-2 border rounded ${activeDayIndex === idx ? "bg-sky-50" : ""}`}
                  onClick={() => onSelectDay(idx)}
                >
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-gray-600">{d.stats?.distance_m ? `${(d.stats.distance_m/1000).toFixed(2)} km` : ""}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <strong>Images</strong>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={`img-${i}`}
                  className="w-full h-20 object-cover rounded cursor-pointer"
                  onClick={() => { setGalleryStartIndex(i); setGalleryOpen(true); }}
                />
              ))}
            </div>

            {images.length > 0 && (
              <div className="mt-2">
                <button className="px-2 py-1 border rounded text-sm" onClick={() => { setGalleryStartIndex(0); setGalleryOpen(true); }}>
                  View photos
                </button>
              </div>
            )}

            {/* render the lightbox */}
            {galleryOpen && (
              <LightboxGallery
                images={images}
                initialIndex={galleryStartIndex}
                onClose={() => setGalleryOpen(false)}
              />
            )}
          </div>

          <div>
            <strong>Extent</strong>
            <div className="text-sm text-gray-600 mt-2">
              {combinedGeojson ? (
                (() => {
                  try {
                    const bbox = turf.bbox(combinedGeojson);
                    return <div>{bbox.map(n => n.toFixed(6)).join(", ")}</div>;
                  } catch {
                    return <div>—</div>;
                  }
                })()
              ) : <div>—</div>}
            </div>
          </div>
        </aside>
      </div>

      {error && <div className="mt-3 p-2 bg-red-50 text-red-700 rounded">{error}</div>}
      {loading && <div className="mt-3 text-sm text-gray-600">Loading…</div>}
    </div>
  );
}
