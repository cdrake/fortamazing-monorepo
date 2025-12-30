"use client";

import React, { JSX, useCallback, useEffect, useRef, useState } from "react";
import type { FeatureCollection, Geometry, Position } from "geojson";
import * as turf from "@turf/turf";
import { getAuth } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { gpx as parseGpx, kml as parseKml } from "togeojson";
import type { Map as LeafletMap } from "leaflet";
import ClientFileInput from "@/app/hikes/components/ClientFileInput"; // ensure this exists (client-only picker)
import { useMap } from "react-leaflet"; // top-level import (client-only file ok)

// NEW: import helper to save hikes with Storage + Firestore
import { saveAllWithStorage } from "../lib/hikeUploader";
import { DayTrack } from "../lib/geo";

// Storage
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";

/**
 * TrackUploader - multi-file GPX/KML uploader and preview
 * - multiple files (via ClientFileInput and drag/drop)
 * - basemap selection
 * - compute combined extents and auto-fit
 * - per-day layers + combined overlay
 *
 * Exposes `registerLoad?: (fn: (hikeId: string) => Promise<void>) => void` so parent can load a saved hike into the preview.
 */

type UploadState = "idle" | "parsing" | "preview" | "saving" | "saved" | "error";

type TrackUploaderProps = {
  registerLoad?: (fn: (hikeId: string) => Promise<void>) => void;
};

// ----- Palette & Tile layers -----
const PALETTE = ["#e74c3c", "#f39c12", "#27ae60", "#2980b9", "#8e44ad", "#c0392b", "#d35400", "#16a085"];

const TILE_LAYERS = [
  { id: "osm", name: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", options: { maxZoom: 19, tileSize: 256 } },
  { id: "opentopo", name: "OpenTopoMap", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", options: { maxZoom: 17, tileSize: 256 } },
  { id: "stamen-toner", name: "Stamen Toner", url: "https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png", options: { maxZoom: 20, tileSize: 256 } },
];

function MapSetter({ onReady }: { onReady: (map: any) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    try {
      onReady(map);
    } catch (e) {
      console.warn("MapSetter onReady failed", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

// ----- Toast helper (small inline) -----
function Toast({ message, show, onClose }: { message: string; show: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onClose(), 4000);
    return () => clearTimeout(t);
  }, [show, onClose]);

  if (!show) return null;
  return (
    <div style={{
      position: "fixed",
      top: 20,
      right: 20,
      zIndex: 9999,
      background: "rgba(0,0,0,0.85)",
      color: "white",
      padding: "10px 14px",
      borderRadius: 8,
      boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
      maxWidth: 360,
      fontSize: 14,
    }}>
      {message}
    </div>
  );
}

// Convert EXIF GPS tag values into decimal degrees.
// Accepts the expanded tags object (or partial subset) and returns { lat, lon } or null.
function gpsToDecimal(gps: any): { lat: number; lon: number } | null {
  try {
    const latVals = gps.GPSLatitude?.description || gps.GPSLatitude;
    const latRef = gps.GPSLatitudeRef?.description || gps.GPSLatitudeRef?.value || gps.GPSLatitudeRef;
    const lonVals = gps.GPSLongitude?.description || gps.GPSLongitude;
    const lonRef = gps.GPSLongitudeRef?.description || gps.GPSLongitudeRef?.value || gps.GPSLongitudeRef;

    if (!latVals || !lonVals) return null;

    const parseArr = (v: any) => {
      if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x.value ? Number(x.value) : Number(x)));
      if (typeof v === "string") return v.split(",").map(Number);
      return null;
    };

    const la = parseArr(latVals);
    const lo = parseArr(lonVals);
    if (!la || !lo) return null;

    const lat = la[0] + (la[1] || 0) / 60 + (la[2] || 0) / 3600;
    const lon = lo[0] + (lo[1] || 0) / 60 + (lo[2] || 0) / 3600;

    const latSign = (String(latRef || "").toUpperCase() === "S") ? -1 : 1;
    const lonSign = (String(lonRef || "").toUpperCase() === "W") ? -1 : 1;

    return { lat: lat * latSign, lon: lon * lonSign };
  } catch (e) {
    return null;
  }
}

// Extract GPS EXIF from a local File object (best-effort).
async function extractExifFromFile(file: File): Promise<{ lat: number; lon: number } | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const ExifReader = (await import("exifreader")).default ?? (await import("exifreader"));
    const tags = ExifReader.load(arrayBuffer, { expanded: true });
    const gps = tags?.gps || tags;
    return gpsToDecimal(gps || {});
  } catch (e) {
    console.warn("Failed to extract EXIF from file", e);
    return null;
  }
}

// Extract GPS EXIF from a remote image URL (best-effort).
async function extractExifFromUrl(url: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error("fetch failed");
    const arrayBuffer = await resp.arrayBuffer();
    const ExifReader = (await import("exifreader")).default ?? (await import("exifreader"));
    const tags = ExifReader.load(arrayBuffer, { expanded: true });
    const gps = tags?.gps || tags;
    return gpsToDecimal(gps || {});
  } catch (e) {
    console.warn("Failed to extract EXIF from url (CORS or not an image):", e);
    return null;
  }
}

export default function TrackUploader({ registerLoad }: TrackUploaderProps): JSX.Element {
  const [RL, setRL] = useState<any | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [dayTracks, setDayTracks] = useState<DayTrack[]>([]);
  const [combinedGeojson, setCombinedGeojson] = useState<FeatureCollection<Geometry> | null>(null);
  const [combinedStats, setCombinedStats] = useState<{ distance_m: number; elevation: { min:number; max:number } | null; bounds: [number,number,number,number] | null } | null>(null);
  const [fileNameList, setFileNameList] = useState<string[]>([]);
  const [title, setTitle] = useState<string>("");
  const [descriptionMd, setDescriptionMd] = useState<string>("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTileId, setActiveTileId] = useState<string>(TILE_LAYERS[0].id);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const mapReadyRef = useRef<boolean>(false);

  const [directFallback, setDirectFallback] = useState(false);
  const directDivId = "direct-leaflet-fallback";

  // toast state
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastShow, setToastShow] = useState<boolean>(false);

  // set Leaflet default icon URLs (dynamic import; client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;
    (async () => {
      try {
        const Lmod = await import("leaflet");
        const L: any = (Lmod as any).default ?? Lmod;

        const m1mod = await import("leaflet/dist/images/marker-icon.png");
        const m2mod = await import("leaflet/dist/images/marker-icon-2x.png");
        const shadowMod = await import("leaflet/dist/images/marker-shadow.png");

        const markerUrl = (m1mod && (m1mod.default ?? (m1mod as any).src)) || "/leaflet/marker-icon.png";
        const marker2x = (m2mod && (m2mod.default ?? (m2mod as any).src)) || "/leaflet/marker-icon-2x.png";
        const shadowUrl = (shadowMod && (shadowMod.default ?? (shadowMod as any).src)) || "/leaflet/marker-shadow.png";

        if (!mounted) return;

        L.Icon.Default.mergeOptions({
          iconRetinaUrl: marker2x,
          iconUrl: markerUrl,
          shadowUrl: shadowUrl,
        });
      } catch (e) {
        console.warn("Failed to set Leaflet default icon URLs (dynamic import)", e);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // dynamic import react-leaflet
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;
    import("react-leaflet")
      .then((mod) => { if (mounted) setRL(mod); })
      .catch((err) => console.error("react-leaflet dynamic import failed:", err));
    return () => { mounted = false; };
  }, []);

  // image input change handler
  const onImageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const arr = Array.from(e.target.files);
    setImageFiles(arr);

    // generate previews (revoke previous first)
    setImagePreviews(prev => {
      prev.forEach(u => {
        try { URL.revokeObjectURL(u); } catch {}
      });
      return arr.map(f => URL.createObjectURL(f));
    });
  }, []);

  useEffect(() => {
    return () => {
      // cleanup previews on unmount
      imagePreviews.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on unmount

  // ----- helpers -----
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

  function mergeDays(days: DayTrack[]) {
    const features = days.flatMap(d => d.geojson.features);
    return { type: "FeatureCollection", features } as FeatureCollection<Geometry>;
  }

  function forceTileRedraw(map: any) {
    if (!map) return;
    try {
      // basic, safe approach: invalidate + delayed invalidation
      try { map.invalidateSize(true); } catch (e) { console.warn("invalidateSize failed", e); }
      setTimeout(() => {
        try { map.invalidateSize(true); } catch (e) { console.warn("delayed invalidateSize failed", e); }
      }, 200);
    } catch (e) {
      console.warn("forceTileRedraw error", e);
    }
  }

  async function addMarker(
    lat: number,
    lon: number,
    url: string,
    opts?: {
      title?: string;
      open?: boolean; // whether to auto-open the popup
    }
  ) {
    const map = mapRef.current as any;
    if (!map) {
      console.warn("addMarker: map not ready");
      return;
    }

    // load Leaflet dynamically (client-safe)
    const Lmod = await import("leaflet");
    const L: any = (Lmod as any).default ?? Lmod;

    const marker = L.marker([lat, lon]).addTo(map);

    const popupHtml = `
      <div style="font-size:14px;">
        ${opts?.title ? `<strong>${opts.title}</strong><br/>` : ""}
        <a href="${url}" target="_blank" rel="noopener noreferrer">
          ${url}
        </a>
      </div>
    `;

    marker.bindPopup(popupHtml);

    if (opts?.open) {
      marker.openPopup();
    }

    return marker;
  }

  // robust onMapCreated
  const onMapCreated = useCallback((mapInstance: any) => {
    mapRef.current = mapInstance;
    mapReadyRef.current = true;

    // expose for debugging
    // @ts-ignore
    window._fortAmazingMap = mapInstance;

    try {
      setTimeout(() => {
        try { mapInstance.invalidateSize(); } catch (e) {}
        if (combinedGeojson) {
          try {
            const bbox = turf.bbox(combinedGeojson);
            const b: [[number, number], [number, number]] = [[bbox[1], bbox[0]], [bbox[3], bbox[2]]];
            mapInstance.fitBounds(b as any, { padding: [20, 20], maxZoom: 15 });
            forceTileRedraw(mapInstance);
          } catch (e) { console.warn("fitBounds in onMapCreated failed", e); }
        }
      }, 120);
    } catch (e) { console.warn("onMapCreated init error", e); }
  }, [combinedGeojson]);

  // helper to wait for map (useful in other async code)
  async function waitForMap(timeoutMs = 5000, intervalMs = 150) {
    const start = Date.now();
    return new Promise<any | null>((resolve) => {
      if (mapReadyRef.current && mapRef.current) return resolve(mapRef.current);
      const iv = window.setInterval(() => {
        if (mapReadyRef.current && mapRef.current) {
          clearInterval(iv);
          resolve(mapRef.current);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          resolve(null);
        }
      }, intervalMs);
    });
  }

  // small debug effect: logs when mapRef becomes available
  useEffect(() => {
    const id = setInterval(() => {
      if (mapRef.current) {
        console.log("[TrackUploader] mapRef is now set:", mapRef.current);
        clearInterval(id);
      }
    }, 200);
    // stop after a while
    setTimeout(() => clearInterval(id), 5000);
    return () => clearInterval(id);
  }, []);

  // fallback direct leaflet creation (unchanged)
  useEffect(() => {
    if (!directFallback) return;
    let directMap: any = null;
    (async () => {
      try {
        const Lmod = await import("leaflet");
        const L: any = (Lmod as any).default ? (Lmod as any).default : Lmod;
        const el = document.getElementById(directDivId);
        if (!el) return;
        directMap = L.map(el).setView([-41.17, 174.09], 10);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, tileSize: 256, detectRetina: false }).addTo(directMap);

        if (combinedGeojson) {
          const gj = L.geoJSON(combinedGeojson as any, { style: { color: "#ff5722", weight: 4 } }).addTo(directMap);
          try { directMap.fitBounds(gj.getBounds(), { padding: [20, 20] }); } catch {}
        }
        forceTileRedraw(directMap);
        // @ts-ignore
        window._directLeaflet = directMap;
        mapRef.current = directMap;
        mapReadyRef.current = true;
      } catch (e) { console.error("direct fallback failed", e); }
    })();
    return () => { try { if (directMap) directMap.remove(); } catch {} };
  }, [directFallback, combinedGeojson]);

  // ----- FILE PARSING (robust for multiple files & multi-track files) -----
  const handleFiles = useCallback(async (filesOrList: FileList | File[] | null) => {
    setError(null);
    if (!filesOrList) return;
    setState("parsing");

    const files: File[] = (filesOrList as FileList).item ? Array.from(filesOrList as FileList) : (filesOrList as File[]);
    if (files.length === 0) { setState("idle"); return; }

    try {
      const parsedDays: DayTrack[] = [];
      const names: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        names.push(f.name);
        const text = await f.text();
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");

        let gjson: FeatureCollection<Geometry>;
        if (ext === "gpx") gjson = parseGpx(xml);
        else if (ext === "kml") gjson = parseKml(xml);
        else {
          if (text.trim().startsWith("<")) gjson = parseGpx(xml);
          else throw new Error(`Unsupported file type for ${f.name}`);
        }

        if (!gjson.features || gjson.features.length === 0) {
          const wpts = Array.from(xml.getElementsByTagName("wpt") || []);
          if (wpts.length > 0) {
            const wptFeatures = wpts.map((node: Element) => {
              const lat = parseFloat(node.getAttribute("lat") || "0");
              const lon = parseFloat(node.getAttribute("lon") || "0");
              return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [lon, lat] },
                properties: { name: node.getAttribute("name") || null }
              };
            });
            gjson = { type: "FeatureCollection", features: wptFeatures } as FeatureCollection<Geometry>;
          }
        }

        const features = gjson.features || [];
        const hasMultipleLineFeatures = features.length > 1 && features.some((ft) => {
          const t = ft.geometry?.type;
          return t === "LineString" || t === "MultiLineString";
        });

        if (hasMultipleLineFeatures) {
          for (let fi = 0; fi < features.length; fi++) {
            const feat = features[fi];
            const singleFc: FeatureCollection<Geometry> = { type: "FeatureCollection", features: [feat] };
            const stats = computeStats(singleFc);
            const color = PALETTE[parsedDays.length % PALETTE.length] ?? "#3388ff";
            const day: DayTrack = {
              id: `${Date.now()}-${i}-${fi}`,
              name: `${f.name} (part ${fi + 1})`,
              geojson: singleFc,
              stats: { distance_m: stats.distance_m, elevation: stats.elevation, bounds: stats.bounds },
              color,
              visible: true,
              originalFile: f,
            };
            parsedDays.push(day);
          }
        } else {
          const stats = computeStats(gjson);
          const color = PALETTE[parsedDays.length % PALETTE.length] ?? "#3388ff";
          const day: DayTrack = {
            id: `${Date.now()}-${i}`,
            name: f.name,
            geojson: gjson,
            stats: { distance_m: stats.distance_m, elevation: stats.elevation, bounds: stats.bounds },
            color,
            visible: true,
            originalFile: f,
          };
          parsedDays.push(day);
        }
      }

      // expose debug
      // @ts-ignore
      window._parsedDayDebug = parsedDays;

      // update state
      setDayTracks(parsedDays);
      setFileNameList(names);

      const combined = mergeDays(parsedDays);
      setCombinedGeojson(combined);
      const combinedStatsComputed = computeStats(combined);
      setCombinedStats({ distance_m: combinedStatsComputed.distance_m, elevation: combinedStatsComputed.elevation, bounds: combinedStatsComputed.bounds });

      // fit to bounds if we have them
      if (combinedStatsComputed.bounds) {
        const [minX, minY, maxX, maxY] = combinedStatsComputed.bounds;
        const b: [[number, number], [number, number]] = [[minY, minX], [maxY, maxX]];
        const map = mapRef.current;
        if (map) {
          try {
            map.invalidateSize();
            map.fitBounds(b as any, { padding: [20, 20], maxZoom: 15 });
            forceTileRedraw(map);
          } catch (e) {
            const waited = await waitForMap(4000, 200);
            if (waited) {
              try { waited.setView([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2], 12); forceTileRedraw(waited); } catch {}
            } else {
              setDirectFallback(true);
            }
          }
        }
      }

      setState("preview");
    } catch (err) {
      console.error("parse error", err);
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, []);

  const onNativeInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    handleFiles(e.target.files);
    e.target.value = "";
  }, [handleFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const openNativePicker = useCallback(async () => {
    try {
      if ((window as any).showOpenFilePicker) {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [{
            description: "GPX / KML",
            accept: {
              "application/gpx+xml": [".gpx"],
              "application/vnd.google-earth.kml+xml": [".kml"],
              "application/octet-stream": [".gpx", ".kml"]
            }
          }]
        });
        const files = await Promise.all(handles.map((h: any) => h.getFile()));
        handleFiles(files);
        return;
      }
    } catch (err) {
      console.warn("showOpenFilePicker failed, falling back to input", err);
    }
  }, [handleFiles]);

  const toggleDayVisible = useCallback((id: string) => {
    setDayTracks(prev => prev.map(d => d.id === id ? { ...d, visible: !d.visible } : d));
  }, []);

  const clearAll = useCallback(() => {
    setDayTracks([]); setCombinedGeojson(null); setCombinedStats(null); setFileNameList([]); setState("idle");
    imagePreviews.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    setImagePreviews([]);
    setImageFiles([]);
    setTitle("");
    setDescriptionMd("");
    setSelectedHikeId(null);
  }, [imagePreviews]);

  const saveAll = useCallback(async () => {
    setState("saving"); setError(null);
    try {
      if (!dayTracks || dayTracks.length === 0) throw new Error("No tracks to save");
      const chosenTitle = title && title.trim().length ? title.trim() : `Multi-day hike: ${fileNameList.join(", ")}`;
      const result = await saveAllWithStorage({
        title: chosenTitle,
        descriptionMd,
        imageFiles,
        dayTracks,
        combinedGeojson,
        visibility: "private",
      });

      console.log("Hike saved:", result.hikeId, result);
      setState("saved");

      setToastMsg(`Hike saved — id: ${result.hikeId}`);
      setToastShow(true);
    } catch (err) {
      console.error("save error", err);
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      setToastMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setToastShow(true);
    }
  }, [dayTracks, combinedGeojson, fileNameList, title, descriptionMd, imageFiles, clearAll]);

  function getCombinedExtentFromDayTracks(days: DayTrack[] | null) {
    if (!days || days.length === 0) return null;
    const combined = { type: "FeatureCollection", features: days.flatMap(d => d.geojson.features) } as FeatureCollection;
    try {
      const bbox = turf.bbox(combined); // [minLon, minLat, maxLon, maxLat]
      const [minLon, minLat, maxLon, maxLat] = bbox;
      const sw = [minLat, minLon] as [number, number];
      const ne = [maxLat, maxLon] as [number, number];
      const center = [(minLat + maxLat) / 2, (minLon + maxLon) / 2] as [number, number];
      return { bbox, sw, ne, center };
    } catch (e) {
      return null;
    }
  }

  useEffect(() => {
    const ext = getCombinedExtentFromDayTracks(dayTracks);
    // @ts-ignore
    window._combinedExtent = ext ?? null;
    if (!ext || !mapRef.current) return;
    try {
      (mapRef.current as any).fitBounds([ext.sw, ext.ne], { padding: [24, 24], maxZoom: 16 });
      forceTileRedraw(mapRef.current);
    } catch (e) { console.warn("fitBounds failed:", e); }
  }, [dayTracks]);

  // -------------------------------------------------------------------------
  // loadHike: this is registered with parent via registerLoad so parent can ask
  // the uploader to load a saved hike into the preview map.
  // -------------------------------------------------------------------------
  const [selectedHikeId, setSelectedHikeId] = useState<string | null>(null);

  const loadHike = useCallback(async (hikeId: string) => {
    try {
      setState("parsing");
      setError(null);
      setSelectedHikeId(hikeId);

      const user = getAuth().currentUser;
      if (!user) throw new Error("Not signed in");

      const docRef = doc(db, "users", user.uid, "hikes", hikeId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Hike not found");

      const data: any = docSnap.data();

      // Title and description
      setTitle(data.title || "");
      setDescriptionMd(data.descriptionMd || "");

      // If days and combinedUrl are available, reconstruct DayTrack array using minimal fields + fetch per-day geojson URLs if present
      let loadedDayTracks: DayTrack[] = [];
      let loadedCombined: FeatureCollection<Geometry> | null = null;
      if (Array.isArray(data.days) && data.days.length > 0) {
        const storage = getStorage();
        for (let i = 0; i < data.days.length; i++) {
          const d = data.days[i];
          let geojson: FeatureCollection<Geometry> | null = null;
          try {
            const possibleUrl = d.geojsonUrl ?? d.geojson ?? null;
            if (possibleUrl && typeof possibleUrl === "string") {
              if (possibleUrl.startsWith("gs://") || possibleUrl.includes("/o/")) {
                try {
                  const ref = storageRef(storage, possibleUrl.replace(/^gs:\/\//, ""));
                  const dl = await getDownloadURL(ref);
                  const resp = await fetch(dl);
                  geojson = await resp.json();
                } catch (e) {
                  console.warn("failed to resolve storage path for day geojson:", e);
                }
              } else {
                try {
                  const resp = await fetch(possibleUrl);
                  geojson = await resp.json();
                } catch (e) {
                  console.warn("failed to fetch day geojson url:", e);
                }
              }
            }
          } catch (e) {
            console.warn("error fetching per-day geojson:", e);
          }

          const fc = geojson ?? { type: "FeatureCollection", features: [] } as FeatureCollection<Geometry>;
          loadedDayTracks.push({
            id: d.id ?? `saved-${hikeId}-${i}`,
            name: d.name ?? `Day ${i+1}`,
            geojson: fc,
            stats: d.stats ?? computeStats(fc),
            color: d.color ?? PALETTE[i % PALETTE.length],
            visible: typeof d.visible === "boolean" ? d.visible : true,
            originalFile: undefined,
          });
        }
      }

      // attempt to load combined geojson if combinedUrl present
      if (data.combinedUrl && typeof data.combinedUrl === "string") {
        try {
          const combinedUrl = data.combinedUrl;
          const storage = getStorage();
          if (combinedUrl.startsWith("gs://") || combinedUrl.includes("/o/")) {
            const ref = storageRef(storage, combinedUrl.replace(/^gs:\/\//, ""));
            const dl = await getDownloadURL(ref);
            const resp = await fetch(dl);
            loadedCombined = await resp.json();
          } else {
            const resp = await fetch(combinedUrl);
            loadedCombined = await resp.json();
          }
        } catch (e) {
          console.warn("failed to load combinedGeojsonUrl:", e);
        }
      }

      if ((!loadedDayTracks || loadedDayTracks.length === 0) && loadedCombined) {
        const features = loadedCombined.features || [];
        for (let i = 0; i < features.length; i++) {
          const feat = features[i];
          const singleFc: FeatureCollection<Geometry> = { type: "FeatureCollection", features: [feat] };
          const stats = computeStats(singleFc);
          loadedDayTracks.push({
            id: `${hikeId}-feat-${i}`,
            name: `Part ${i+1}`,
            geojson: singleFc,
            stats: { distance_m: stats.distance_m, elevation: stats.elevation, bounds: stats.bounds },
            color: PALETTE[i % PALETTE.length],
            visible: true,
            originalFile: undefined,
          });
        }
      }

      // set states
      setDayTracks(loadedDayTracks);
      setCombinedGeojson(loadedCombined ?? mergeDays(loadedDayTracks));
      setCombinedStats(loadedCombined ? computeStats(loadedCombined) : computeStats(mergeDays(loadedDayTracks)));

      // images handling: either direct URLs in doc (images array) or storage paths
      const previews: string[] = [];
      try {
        const storage = getStorage();
        if (Array.isArray(data.images) && data.images.length) {
          for (const im of data.images) {
            if (!im) continue;
            const maybeUrl = im.url ?? im.path ?? null;
            if (!maybeUrl) continue;
            try {
              if (maybeUrl.startsWith("gs://") || maybeUrl.includes("/o/")) {
                const ref = storageRef(storage, maybeUrl.replace(/^gs:\/\//, ""));
                const dl = await getDownloadURL(ref);
                previews.push(dl);
              } else {
                previews.push(maybeUrl);
              }
            } catch (e) {
              console.warn("image fetch failed for", maybeUrl, e);
            }
          }
        }
      } catch (e) { console.warn("image preview load error", e); }
      imagePreviews.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
      setImagePreviews(previews);
      setImageFiles([]);

      // fit map to loaded bounds
      setTimeout(() => {
        const map = mapRef.current;
        try {
          const ext = getCombinedExtentFromDayTracks(loadedDayTracks);
          if (map && ext) {
            (map as any).fitBounds([ext.sw, ext.ne], { padding: [24, 24], maxZoom: 16 });
            forceTileRedraw(map);
          }
        } catch (e) { console.warn("fit after load failed", e); }
      }, 200);

      setState("preview");
      setToastMsg("Hike loaded");
      setToastShow(true);
    } catch (err) {
      console.error("loadHike error", err);
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      setToastMsg(`Failed to load hike: ${err instanceof Error ? err.message : String(err)}`);
      setToastShow(true);
    }
  }, [imagePreviews]);

  // Register loadHike with parent when provided
  useEffect(() => {
    if (typeof registerLoad === "function") {
      registerLoad(loadHike);
      return () => {
        registerLoad(async () => {});
      };
    }
    return;
  }, [registerLoad, loadHike]);

  // ----- RENDER -----
  return (
    <div style={{ display: "flex", gap: 20 }}>
      <Toast message={toastMsg} show={toastShow} onClose={() => setToastShow(false)} />

      {/* left: controls / file input */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDrop={onDrop}
        style={{
          border: "2px dashed #ddd",
          borderRadius: 8,
          padding: 20,
          width: 360,
          minHeight: 220,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "stretch",
          background: state === "parsing" ? "#fafafa" : "white",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml"
          multiple
          style={{ display: "none" }}
          onChange={onNativeInputChange}
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <ClientFileInput
            onFiles={(filesOrList) => {
              const filesArray: File[] = (filesOrList && (filesOrList as FileList).item) ? Array.from(filesOrList as FileList) : (filesOrList as File[]);
              handleFiles(filesOrList);
            }}
            buttonLabel="Choose GPX files"
          />

          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.click();
              } else {
                openNativePicker();
              }
            }}
            aria-label="Upload GPX or KML files"
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Upload files
          </button>
        </div>

        <div style={{ marginTop: 8 }}>
          <small>Status: {state}</small>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong>Files</strong>
          {fileNameList.length === 0 ? (
            <div style={{ color: "#777", marginTop: 8 }}>No files selected — drag & drop multiple GPX/KML files here, or click Choose GPX files / Upload files.</div>
          ) : (
            <ol style={{ paddingLeft: 18 }}>
              {dayTracks.map((d, idx) => (
                <li key={d.id} style={{ marginBottom: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={d.visible} onChange={() => toggleDayVisible(d.id)} />
                    <span style={{ width: 12, height: 12, background: d.color, display: "inline-block", borderRadius: 3 }} />
                    <span style={{ marginLeft: 6 }}>{`Day ${idx+1}: ${d.name}`}</span>
                    <small style={{ marginLeft: "auto", color: "#666" }}>{(d.stats.distance_m/1000).toFixed(2)} km</small>
                  </label>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontWeight: 600 }}>Hike title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My multi-day hike title..."
            className="border p-2 rounded w-full"
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontWeight: 600 }}>Description (Markdown)</label>
          <textarea
            value={descriptionMd}
            onChange={(e) => setDescriptionMd(e.target.value)}
            placeholder="Add notes, route commentary, gear notes..."
            rows={6}
            className="border p-2 rounded w-full"
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontWeight: 600 }}>Images</label>
          <input type="file" accept="image/*" multiple onChange={onImageInputChange} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {imagePreviews.map((src, i) => (
              <div key={i} style={{ width: 120, height: 80, overflow: "hidden", borderRadius: 6, border: "1px solid #eee" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`preview-${i}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={saveAll} disabled={!dayTracks.length || state === "saving"}>Save hike</button>
          <button onClick={clearAll} disabled={!dayTracks.length}>Clear</button>
        </div>

        {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      </div>

      {/* right: map + preview */}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <strong>Preview</strong>
          {fileNameList.length > 0 && <span style={{ marginLeft: 12, color: "#666" }}>{fileNameList.join(", ")}</span>}
        </div>

        <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontWeight: 600 }}>Basemap:</label>
          <select value={activeTileId} onChange={(e) => setActiveTileId(e.target.value)}>
            {TILE_LAYERS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={() => {
            const ext = getCombinedExtentFromDayTracks(dayTracks);
            if (ext && mapRef.current) {
              (mapRef.current as any).fitBounds([ext.sw, ext.ne], { padding: [24, 24], maxZoom: 16 });
              forceTileRedraw(mapRef.current);
            }
          }}>Fit to all tracks</button>
        </div>

        <div
          ref={wrapperRef}
          style={{
            height: 480,
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid #eee",
            position: "relative",
          }}
        >
          {directFallback ? (
            <div id={directDivId} style={{ height: "100%", width: "100%" }} />
          ) : !RL ? (
            <div style={{ padding: 20 }}>Loading map…</div>
          ) : (
            // @ts-ignore
            <RL.MapContainer
              whenCreated={onMapCreated}
              style={{
                height: "100%",
                width: "100%",
                position: "absolute",
                left: 0,
                top: 0,
              }}
              center={[-41.17, 174.09]}
              zoom={10}
              scrollWheelZoom={true}
            >
              <MapSetter onReady={onMapCreated} />
              {/* Basemap */}
              {/* @ts-ignore */}
              <RL.TileLayer
                key={activeTileId}
                url={TILE_LAYERS.find((t) => t.id === activeTileId)!.url}
                {...(TILE_LAYERS.find((t) => t.id === activeTileId)!.options || {})}
              />

              {/* Combined */}
              {combinedGeojson && (
                // @ts-ignore
                <RL.GeoJSON
                  data={combinedGeojson}
                  style={() => ({
                    color: "#ff5722",
                    weight: 4,
                    opacity: 0.30,
                  })}
                />
              )}

              {/* Days */}
              {dayTracks.map(
                (d) =>
                  d.visible && (
                    // @ts-ignore
                    <RL.GeoJSON
                      key={d.id}
                      data={d.geojson}
                      style={() => ({
                        color: d.color,
                        weight: 5,
                        opacity: 1.0,
                      })}
                      // @ts-ignore - ensures colored circle markers for waypoint/point features
                      pointToLayer={(_feature: any, latlng: any) => {
                        return RL.circleMarker(latlng, {
                          radius: 5,
                          fill: true,
                          fillOpacity: 0.9,
                          color: d.color,
                          weight: 1,
                          opacity: 0.95,
                        });
                      }}
                    />
                  )
              )}
            </RL.MapContainer>
          )}
        </div>

        {/* extents & stats display */}
        <div style={{ marginTop: 12 }}>
          {(() => {
            const ext = getCombinedExtentFromDayTracks(dayTracks);
            if (!ext) return <div style={{ color: "#666" }}>No extent (no tracks loaded)</div>;
            return (
              <>
                <div><strong>Extent (bbox lon,lat):</strong> {ext.bbox.map(n => n.toFixed(6)).join(", ")}</div>
                <div><strong>SW (lat,lon):</strong> {ext.sw.map(n => n.toFixed(6)).join(", ")} <strong>NE (lat,lon):</strong> {ext.ne.map(n => n.toFixed(6)).join(", ")}</div>
                <div><strong>Center:</strong> {ext.center.map(n => n.toFixed(6)).join(", ")}</div>
              </>
            );
          })()}
        </div>

        {combinedStats && (
          <div style={{ marginTop: 12 }}>
            <div><strong>Total distance:</strong> {(combinedStats.distance_m / 1000).toFixed(2)} km</div>
            {combinedStats.elevation && <div><strong>Elevation:</strong> {Math.round(combinedStats.elevation.min)}–{Math.round(combinedStats.elevation.max)} m</div>}
            {combinedStats.bounds && <div><strong>Bounds (lon,lat):</strong> {combinedStats.bounds.join(", ")}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
