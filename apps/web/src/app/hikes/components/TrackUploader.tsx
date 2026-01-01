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
import ClientFileInput from "@/app/hikes/components/ClientFileInput";
import { createHikeWithStorage } from "../lib/hikeEditor";
import { DayTrack } from "../lib/geo";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";
import { convertHeicFile, extractExifFromFile, extractExifFromUrl, insertGpsExifIntoJpeg, LatLon } from "../lib/imageHelpers";
import MarkdownEditor from "./MarkdownEditor";

/**
 * TrackUploader component
 * - Upload & preview GPX/KML day tracks
 * - Load saved hikes (users/{uid}/hikes/{hikeId})
 * - Show combined preview, fit to extent
 * - Add markers (generic addMarker function)
 * - Load images and (best-effort) extract EXIF from image URLs to add markers when inside extent
 *
 * Notes:
 * - dynamic imports used for react-leaflet/leaflet and heavy EXIF libs to keep bundle small and SSR-safe
 * - this is a client-only component ("use client")
 */

type UploadState = "idle" | "parsing" | "preview" | "saving" | "saved" | "error";

type TrackUploaderProps = {
  registerLoad?: (fn: (hikeId: string) => Promise<void>) => void;
};

const PALETTE = ["#e74c3c", "#f39c12", "#27ae60", "#2980b9", "#8e44ad", "#c0392b", "#d35400", "#16a085"];

const TILE_LAYERS = [
  { id: "osm", name: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", options: { maxZoom: 19, tileSize: 256 } },
  { id: "opentopo", name: "OpenTopoMap", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", options: { maxZoom: 17, tileSize: 256 } },
  { id: "stamen-toner", name: "Stamen Toner", url: "https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png", options: { maxZoom: 20, tileSize: 256 } },
];

function MapSetter({ onReady }: { onReady: (map: any) => void }) {
  // useMap must be used inside a MapContainer; dynamic import of react-leaflet loads it
  // This component is inserted inside the MapContainer to obtain the `map` instance
  // Note: The file using MapSetter must be client-side
  // We import useMap lazily to avoid compile-time errors if react-leaflet is not loaded.
  // But here we can import it directly since the file is client-only and react-leaflet is dynamically loaded in parent.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useMap } = require("react-leaflet");
    const MapSetterInner = () => {
      const map = useMap();
      React.useEffect(() => {
        if (map && typeof onReady === "function") onReady(map);
      }, [map]);
      return null;
    };
    // render the inner functional component
    return <MapSetterInner /> as any;
  } catch (e) {
    // if react-leaflet not available yet, render nothing
    return null;
  }
}

// Small toast
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

// EXIF helpers (local, small)
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
  } catch {
    return null;
  }
}

export default function TrackUploader({ registerLoad }: TrackUploaderProps): JSX.Element {
  // dynamic react-leaflet reference (set when imported)
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [activeTileId, setActiveTileId] = useState<string>(TILE_LAYERS[0].id);

  // map refs
  const mapRef = useRef<LeafletMap | null>(null);
  const mapReadyRef = useRef<boolean>(false);

  // image modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState<number>(0);

  // toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);

  // track image markers added to the map so we can clear them
  const markersRef = useRef<any[]>([]);

  // load react-leaflet lazily (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;
    import("react-leaflet")
      .then((mod) => { if (mounted) setRL(mod); })
      .catch((err) => console.error("react-leaflet dynamic import failed:", err));
    return () => { mounted = false; };
  }, []);

  // fix Leaflet icons by dynamically importing image assets & setting L.Icon.Default options
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;
    (async () => {
      try {
        const Lmod = await import("leaflet");
        const L: any = (Lmod as any).default ?? Lmod;
        // import images; bundlers differ so handle both shapes
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
          shadowUrl,
        });
      } catch (e) {
        console.warn("Failed to set Leaflet icon images:", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function clearImageMarkers() {
    try {
      const Lmod = (window as any).L || null;
      const markers = markersRef.current || [];
      markers.forEach((m: any) => {
        try { m.remove?.(); } catch {}
        try { (m as any).off?.(); } catch {}
        try {
          const el = (m as any)._imagePreviewEl;
          if (el && el.parentNode) el.parentNode.removeChild(el);
        } catch {}
        try {
          if ((m as any)._mobilePreviewCleanup) (m as any)._mobilePreviewCleanup();
        } catch {}
      });
      markersRef.current = [];
    } catch (e) {
      // best-effort
      markersRef.current = [];
      console.warn("clearImageMarkers error", e);
    }
  }

  // ---- simple helpers: compute stats / merge ----
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

  // wait for map helper
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

  async function convertHeicFileToJpegFile(file: File): Promise<File> {
  // wrapper that calls the new heic-to based converter and normalizes output to a File (JPEG).
  const filenameBase = (file.name || "image").replace(/\.[^.]+$/, "");
  if (typeof window === "undefined") {
    throw new Error("HEIC conversion unavailable in SSR environment");
  }

  try {
    // call the shared converter (heic-to). It returns a ConvertResult-like object.
    const res: any = await convertHeicFile(file, { type: "image/jpeg", quality: 0.92 });

    // accept either File or Blob in res.file
    const outBlobOrFile = res?.file ?? null;
    if (!outBlobOrFile) {
      const reason = res?.reason ?? "Conversion returned no file";
      throw new Error(String(reason));
    }

    // normalize to File
    let outFile: File;
    if (outBlobOrFile instanceof File) {
      outFile = outBlobOrFile;
    } else {
      // it's a Blob; create a File with .jpg extension
      outFile = new File([outBlobOrFile], `${filenameBase}.jpg`, { type: "image/jpeg" });
    }

    // If converter indicates it didn't convert (res.converted === false), treat as failure to preserve previous behavior
    if (res.converted === false) {
      const reason = res.reason ?? "HEIC conversion not available";
      throw new Error(String(reason));
    }

    return outFile;
  } catch (e: any) {
    // preserve previous behavior: throw so callers can fall back to original or toObjectURL
    throw new Error(e?.message ? String(e.message) : String(e));
  }
}

  // force redraw simplified
  function forceTileRedraw(map: any) {
    if (!map) return;
    try {
      try { map.invalidateSize(true); } catch {}
      setTimeout(() => { try { map.invalidateSize(true); } catch {} }, 200);
    } catch (e) { console.warn("forceTileRedraw error", e); }
  }

 // add this helper near the top of your component file (so markersRef, mapRef are accessible)
function createHoverPreviewElement(imageUrl: string, title?: string, size = 120) {
  const wrapper = document.createElement("div");
  wrapper.className = "map-image-hover-preview";
  wrapper.style.position = "absolute";
  wrapper.style.pointerEvents = "none"; // don't block map interactions
  wrapper.style.zIndex = "10000";
  wrapper.style.display = "none";
  wrapper.style.opacity = "0.95"; // wrapper full opacity; image will use 0.3
  wrapper.style.transform = "translate(-50%, -100%)"; // center above pointer
  wrapper.style.transition = "opacity 120ms ease, transform 120ms ease";

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = title ?? "preview";
  img.loading = "lazy";
  img.style.width = `${size}px`;
  img.style.height = "auto";
  img.style.maxHeight = `${Math.round(size * 0.75)}px`;
  img.style.objectFit = "cover";
  img.style.borderRadius = "6px";
  img.style.opacity = "0.5"; // requested transparency
  img.style.display = "block";
  img.style.pointerEvents = "none";

  // optional: slight shadow to lift it off the map
  wrapper.style.filter = "drop-shadow(0 6px 18px rgba(0,0,0,0.25))";

  wrapper.appendChild(img);
  return wrapper;
}

async function addMarker(
  lat: number,
  lon: number,
  imageUrl: string,
  opts?: {
    title?: string;
    openInNewTab?: boolean; // default true
    previewSize?: number;   // px, default 120
  }
) {
  const map = mapRef.current as any;
  if (!map) {
    console.warn("addMarker: map not ready");
    return null;
  }

  try {
    const Lmod = await import("leaflet");
    const L: any = (Lmod as any).default ?? Lmod;

    const marker = L.marker([lat, lon], {
      title: opts?.title ?? "Open image",
      keyboard: true,
    }).addTo(map);

    // create preview DOM (same helper inline here)
    const createPreview = (imageUrlInner: string, titleInner?: string, size = 120) => {
      const wrapper = document.createElement("div");
      wrapper.className = "map-image-hover-preview";
      wrapper.style.position = "absolute";
      wrapper.style.pointerEvents = "none"; // by default non-interactive for desktop hover
      wrapper.style.zIndex = "10000";
      wrapper.style.display = "none";
      wrapper.style.opacity = "0";
      wrapper.style.transform = "translate(-50%, -105%) scale(0.98)";
      wrapper.style.transition = "opacity 120ms ease, transform 120ms ease";

      const img = document.createElement("img");
      img.src = imageUrlInner;
      img.alt = titleInner ?? "preview";
      img.loading = "lazy";
      img.style.width = `${size}px`;
      img.style.height = "auto";
      img.style.maxHeight = `${Math.round(size * 0.75)}px`;
      img.style.objectFit = "cover";
      img.style.borderRadius = "6px";
      img.style.opacity = "0.3"; // you said you'll raise opacity
      img.style.display = "block";
      img.style.pointerEvents = "none"; // desktop: don't capture pointer
      img.style.userSelect = "none";

      // debug handlers (optional)
      img.onload = () => {
        // eslint-disable-next-line no-console
        console.debug("[addMarker] preview image loaded", { name: titleInner, url: imageUrlInner });
      };
      img.onerror = (ev) => {
        // eslint-disable-next-line no-console
        console.warn("[addMarker] preview image failed to load", { name: titleInner, url: imageUrlInner, ev });
        img.style.opacity = "0.06";
        img.style.filter = "grayscale(1)";
      };

      wrapper.appendChild(img);
      return { wrapper, img };
    };

    const previewSize = opts?.previewSize ?? 120;
    const { wrapper: previewEl, img: previewImg } = createPreview(imageUrl, opts?.title, previewSize);

    // append to map container
    const mapContainer = (map.getContainer && map.getContainer()) || document.querySelector(".leaflet-container");
    if (mapContainer && mapContainer.appendChild) {
      mapContainer.appendChild(previewEl);
    } else {
      document.body.appendChild(previewEl);
    }

    // helpers to show/hide/position preview
    const showPreviewAt = (point: { x: number; y: number }) => {
      previewEl.style.left = `${Math.round(point.x)}px`;
      previewEl.style.top = `${Math.round(point.y - 8)}px`;
      previewEl.style.display = "block";
      // animate in
      requestAnimationFrame(() => {
        previewEl.style.opacity = "1";
        previewEl.style.transform = "translate(-50%, -105%) scale(1)";
      });
    };
    const hidePreview = () => {
      previewEl.style.opacity = "0";
      previewEl.style.transform = "translate(-50%, -105%) scale(0.98)";
      setTimeout(() => {
        try { previewEl.style.display = "none"; } catch {}
      }, 140);
    };

    // detect touch devices
    const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    // Desktop: show preview on marker mouseover, hide on mouseout
    if (!isTouch) {
      const onMouseOver = (ev: any) => {
        try {
          const origEvt = ev?.originalEvent;
          let point;
          if (origEvt && typeof origEvt.clientX === "number") {
            const rect = mapContainer.getBoundingClientRect();
            point = { x: origEvt.clientX - rect.left, y: origEvt.clientY - rect.top };
          } else {
            const latlng = (ev?.latlng) ?? marker.getLatLng();
            const p = map.latLngToContainerPoint(latlng);
            point = { x: p.x, y: p.y };
          }
          // ensure preview remains non-interactive on desktop
          previewEl.style.pointerEvents = "none";
          previewImg.style.pointerEvents = "none";
          showPreviewAt(point);
        } catch (e) {
          const center = map.latLngToContainerPoint(map.getCenter());
          showPreviewAt({ x: center.x, y: center.y });
        }
      };
      const onMouseOut = () => hidePreview();

      marker.on("mouseover", onMouseOver);
      marker.on("mouseout", onMouseOut);

      // also show when mouse enters actual icon element (robustness)
      try {
        const iconEl = marker.getElement?.();
        if (iconEl) {
          iconEl.addEventListener("mouseenter", (ev: MouseEvent) => {
            const rect = mapContainer.getBoundingClientRect();
            showPreviewAt({ x: (ev as MouseEvent).clientX - rect.left, y: (ev as MouseEvent).clientY - rect.top });
          });
          iconEl.addEventListener("mouseleave", hidePreview);
        }
      } catch (e) { /* ignore */ }

      // click on desktop -> open full image (keeps previous behavior)
      const openFull = () => {
        if (opts?.openInNewTab === false) window.location.href = imageUrl;
        else window.open(imageUrl, "_blank", "noopener,noreferrer");
      };
      marker.on("click", openFull);
      marker.on("keypress", (e: any) => {
        if (e.originalEvent?.key === "Enter") openFull();
      });
    } else {
      // Touch device: marker tap toggles preview visibility; tapping preview opens full image.
      // Make preview interactive so it can receive taps
      previewEl.style.pointerEvents = "auto";
      previewImg.style.pointerEvents = "auto";
      previewImg.style.cursor = "pointer";

      const openFull = () => {
        if (opts?.openInNewTab === false) window.location.href = imageUrl;
        else window.open(imageUrl, "_blank", "noopener,noreferrer");
      };

      // marker click shows preview (and positions it)
      const onMarkerClickTouch = (ev: any) => {
        try {
          const rect = mapContainer.getBoundingClientRect();
          const origEvt = ev?.originalEvent;
          let point;
          if (origEvt && typeof origEvt.clientX === "number") {
            point = { x: origEvt.clientX - rect.left, y: origEvt.clientY - rect.top };
          } else {
            const latlng = (ev?.latlng) ?? marker.getLatLng();
            const p = map.latLngToContainerPoint(latlng);
            point = { x: p.x, y: p.y };
          }
          // If preview is already visible at same spot, open full image instead of toggling
          const visible = previewEl.style.display !== "none" && previewEl.style.opacity !== "0";
          if (visible) {
            openFull();
          } else {
            showPreviewAt(point);
          }
        } catch (e) {
          // fallback: open preview at center
          const center = map.latLngToContainerPoint(map.getCenter());
          showPreviewAt({ x: center.x, y: center.y });
        }
      };

      // preview click opens full image
      const onPreviewClick = (ev: MouseEvent) => {
        ev.stopPropagation();
        openFull();
      };

      marker.on("click", onMarkerClickTouch);
      previewEl.addEventListener("click", onPreviewClick, { passive: true });

      // Hide preview when tapping anywhere else on the map
      const onMapClickHide = () => hidePreview();
      map.on("click", onMapClickHide);

      // store cleanup references on marker for later removal
      (marker as any)._mobilePreviewCleanup = () => {
        try { previewEl.removeEventListener("click", onPreviewClick); } catch {}
        try { map.off("click", onMapClickHide); } catch {}
      };
    }

    // store preview element for later cleanup when removing marker
    (marker as any)._imagePreviewEl = previewEl;

    return marker;
  } catch (e) {
    console.warn("addMarker failed", e);
    return null;
  }
}



  // ---- demo helper used previously (kept small) ----
  async function addDemoMarkerAtCenter() {
    if (!combinedStats?.bounds) return;
    const [minLon, minLat, maxLon, maxLat] = combinedStats.bounds;
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    await addMarker(centerLat, centerLon, "https://www.cnn.com", { title: "Demo link"});
  }

  // ---- handle files parsing (GPX/KML) ----
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

        // convert <wpt> to points if needed
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
            parsedDays.push({
              id: `${Date.now()}-${i}-${fi}`,
              name: `${f.name} (part ${fi + 1})`,
              geojson: singleFc,
              stats: { distance_m: stats.distance_m, elevation: stats.elevation, bounds: stats.bounds },
              color,
              visible: true,
              originalFile: f,
            });
          }
        } else {
          const stats = computeStats(gjson);
          const color = PALETTE[parsedDays.length % PALETTE.length] ?? "#3388ff";
          parsedDays.push({
            id: `${Date.now()}-${i}`,
            name: f.name,
            geojson: gjson,
            stats: { distance_m: stats.distance_m, elevation: stats.elevation, bounds: stats.bounds },
            color,
            visible: true,
            originalFile: f,
          });
        }
      }

      // update state
      setDayTracks(parsedDays);
      setFileNameList(names);
      const combined = mergeDays(parsedDays);
      setCombinedGeojson(combined);
      const stats = computeStats(combined);
      setCombinedStats({ distance_m: stats.distance_m, elevation: stats.elevation, bounds: stats.bounds });

      // fit map if available
      if (stats.bounds) {
        const [minX, minY, maxX, maxY] = stats.bounds;
        const b: [[number, number], [number, number]] = [[minY, minX], [maxY, maxX]];
        const map = mapRef.current;
        if (map) {
          try {
            map.invalidateSize();
            map.fitBounds(b as any, { padding: [20, 20], maxZoom: 15 });
            forceTileRedraw(map);
          } catch {
            const waited = await waitForMap(4000, 200);
            if (waited) {
              try { waited.setView([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2], 12); forceTileRedraw(waited); } catch {}
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

  // open native picker
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
    clearImageMarkers();
  }, [imagePreviews]);

  // saveAll - delegate to saveAllWithStorage
  const saveAll = useCallback(async () => {
    setState("saving"); setError(null);
    try {
      if (!dayTracks || dayTracks.length === 0) throw new Error("No tracks to save");
      const chosenTitle = title && title.trim().length ? title.trim() : `Multi-day hike: ${fileNameList.join(", ")}`;
      const result = await createHikeWithStorage({
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
  }, [dayTracks, combinedGeojson, fileNameList, title, descriptionMd, imageFiles]);

  // ---- loadHike (registered with parent) ----
  const [selectedHikeId, setSelectedHikeId] = useState<string | null>(null);
  const loadHike = useCallback(async (hikeId: string) => {
  try {
    console.debug("[loadHike] start", { hikeId });
    setState("parsing");
    setError(null);
    setSelectedHikeId(hikeId);

    // clear any existing image markers right away
    clearImageMarkers();
    console.debug("[loadHike] cleared existing markers");

    const user = getAuth().currentUser;
    if (!user) throw new Error("Not signed in");

    const docRef = doc(db, "users", user.uid, "hikes", hikeId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Hike not found");

    const data: any = docSnap.data();
    console.debug("[loadHike] loaded hike doc", { id: hikeId, title: data?.title });

    setTitle(data.title || "");
    setDescriptionMd(data.descriptionMd || "");

    let loadedDayTracks: DayTrack[] = [];
    let loadedCombined: FeatureCollection<Geometry> | null = null;

    // load per-day geojsons if present
    if (Array.isArray(data.days) && data.days.length > 0) {
      const storage = getStorage();
      for (let i = 0; i < data.days.length; i++) {
        const d = data.days[i];
        let geojson: FeatureCollection<Geometry> | null = null;
        try {
          const possibleUrl = d.geojsonUrl ?? d.geojson ?? null;
          if (possibleUrl && typeof possibleUrl === "string") {
            console.debug("[loadHike] resolving day geojson url", { idx: i, possibleUrl });
            if (possibleUrl.startsWith("gs://") || possibleUrl.includes("/o/")) {
              try {
                const ref = storageRef(storage, possibleUrl.replace(/^gs:\/\//, ""));
                const dl = await getDownloadURL(ref);
                console.debug("[loadHike] got downloadURL for day geojson", { dl });
                const resp = await fetch(dl);
                geojson = await resp.json();
              } catch (e) {
                console.warn("[loadHike] failed to resolve storage path for day geojson:", e);
              }
            } else {
              try {
                console.debug("[loadHike] fetching day geojson from external url", possibleUrl);
                const resp = await fetch(possibleUrl);
                geojson = await resp.json();
              } catch (e) {
                console.warn("[loadHike] failed to fetch day geojson url:", e);
              }
            }
          }
        } catch (e) {
          console.warn("[loadHike] error fetching per-day geojson:", e);
        }

        const fc = geojson ?? { type: "FeatureCollection", features: [] } as FeatureCollection<Geometry>;
        const stats = computeStats(fc);
        loadedDayTracks.push({
          id: d.id ?? `saved-${hikeId}-${i}`,
          name: d.name ?? `Day ${i+1}`,
          geojson: fc,
          stats: d.stats ?? stats,
          color: d.color ?? PALETTE[i % PALETTE.length],
          visible: typeof d.visible === "boolean" ? d.visible : true,
          originalFile: undefined,
        });
        console.debug("[loadHike] added dayTrack", { idx: i, id: loadedDayTracks[loadedDayTracks.length - 1].id, stats });
      }
    }

    // load combined geojson if present
    if (data.combinedUrl && typeof data.combinedUrl === "string") {
      try {
        const combinedUrl = data.combinedUrl;
        const storage = getStorage();
        console.debug("[loadHike] resolving combinedUrl", { combinedUrl });
        if (combinedUrl.startsWith("gs://") || combinedUrl.includes("/o/")) {
          const ref = storageRef(storage, combinedUrl.replace(/^gs:\/\//, ""));
          const dl = await getDownloadURL(ref);
          const resp = await fetch(dl);
          loadedCombined = await resp.json();
        } else {
          const resp = await fetch(combinedUrl);
          loadedCombined = await resp.json();
        }
        console.debug("[loadHike] loaded combined geojson", { loadedCombinedFeatures: loadedCombined?.features?.length ?? 0 });
      } catch (e) {
        console.warn("[loadHike] failed to load combinedGeojsonUrl:", e);
      }
    }

    // if no per-day tracks, derive from combined
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
        console.debug("[loadHike] derived dayTrack from combined", { idx: i, stats });
      }
    }

    setDayTracks(loadedDayTracks);
    setCombinedGeojson(loadedCombined ?? mergeDays(loadedDayTracks));
    setCombinedStats(loadedCombined ? computeStats(loadedCombined) : computeStats(mergeDays(loadedDayTracks)));
    console.debug("[loadHike] dayTracks & combinedGeojson set", {
      dayTracksCount: loadedDayTracks.length,
      combinedFeatures: (loadedCombined ?? mergeDays(loadedDayTracks)).features.length,
    });

    // images: collect preview urls (resolve gs:// to downloadURL)
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
              console.debug("[loadHike] resolved image storage path to downloadURL", { maybeUrl, dl });
            } else {
              previews.push(maybeUrl);
              console.debug("[loadHike] added image external url", { maybeUrl });
            }
          } catch (e) {
            console.warn("[loadHike] image fetch failed for", maybeUrl, e);
          }
        }
      }
    } catch (e) {
      console.warn("[loadHike] image preview load error", e);
    }

    // clear old object URLs & set new previews
    imagePreviews.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    setImagePreviews(previews);
    setImageFiles([]);
    console.debug("[loadHike] image previews set", { previewCount: previews.length });

    // fit map to extent
    setTimeout(() => {
      const map = mapRef.current;
      try {
        const ext = getCombinedExtentFromDayTracks(loadedDayTracks);
        console.debug("[loadHike] fitting map to extent", { ext });
        if (map && ext) {
          (map as any).fitBounds([ext.sw, ext.ne], { padding: [24, 24], maxZoom: 16 });
          forceTileRedraw(map);
        }
      } catch (e) { console.warn("[loadHike] fit after load failed", e); }
    }, 200);

    // try to extract EXIF GPS from image urls (best-effort) and add markers if inside extent
    (async () => {
      try {
        if (previews.length === 0) {
          console.debug("[loadHike] no image previews to process for EXIF");
          return;
        }

        const ext = getCombinedExtentFromDayTracks(loadedDayTracks);
        if (!ext || !ext.bbox) {
          console.debug("[loadHike] no extent available; skipping image EXIF marker placement");
          return;
        }
        console.debug("[loadHike] beginning EXIF extraction for images", { previewCount: previews.length, bbox: ext.bbox });

        // process sequentially to avoid many concurrent requests
        for (let i = 0; i < previews.length; i++) {
          const url = previews[i];
          try {
            console.debug("[loadHike] extracting exif for image", { index: i, url });
            // direct client-side extraction (no proxy)
            const gps = await extractExifFromUrl(url);
            console.debug("[loadHike] extractExifFromUrl result", { index: i, url, gps });
            if (!gps) {
              console.debug("[loadHike] no GPS found in EXIF for image", { index: i, url });
              continue;
            }

            const [minLon, minLat, maxLon, maxLat] = ext.bbox;
            console.debug("[loadHike] comparing gps to bbox", { index: i, gps, bbox: ext.bbox });
            if (gps.lon >= minLon && gps.lon <= maxLon && gps.lat >= minLat && gps.lat <= maxLat) {
              const marker = await addMarker(gps.lat, gps.lon, url, { title: `Photo ${i+1}` });
              console.debug("[loadHike] addMarker returned", { index: i, marker });
              if (marker) markersRef.current.push(marker);
              else console.warn("[loadHike] addMarker returned falsy marker", { index: i, url });
            } else {
              console.debug("[loadHike] gps outside bbox; skipping marker", { index: i, gps, bbox: ext.bbox });
            }
          } catch (e) {
            console.warn("[loadHike] per-image EXIF/marker error", e, { index: i, url });
          }
        }

        console.debug("[loadHike] finished processing image EXIF for markers", { markersCount: markersRef.current.length });
      } catch (e) {
        console.warn("[loadHike] image EXIF->marker step failed", e);
      }
    })();

    setState("preview");
    setToastMsg("Hike loaded");
    setToastShow(true);
    console.debug("[loadHike] completed successfully", { hikeId });
  } catch (err) {
    console.error("loadHike error", err);
    setError(err instanceof Error ? err.message : String(err));
    setState("error");
    setToastMsg(`Failed to load hike: ${err instanceof Error ? err.message : String(err)}`);
    setToastShow(true);
  }
}, [imagePreviews]);




  // register loadHike with parent
  useEffect(() => {
    if (typeof registerLoad === "function") {
      registerLoad(loadHike);
      return () => { registerLoad(async () => {}); };
    }
  }, [registerLoad, loadHike]);

  // helper used by multiple places
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
    } catch { return null; }
  }

  // Map creation handler (used by MapSetter)
  const onMapCreated = useCallback((mapInstance: any) => {
    mapRef.current = mapInstance;
    mapReadyRef.current = true;
    // expose for debug
    // @ts-ignore
    window._fortAmazingMap = mapInstance;
    setTimeout(() => {
      try { mapInstance.invalidateSize(); } catch {}
      if (combinedGeojson) {
        try {
          const bbox = turf.bbox(combinedGeojson);
          const b: [[number, number], [number, number]] = [[bbox[1], bbox[0]], [bbox[3], bbox[2]]];
          mapInstance.fitBounds(b as any, { padding: [20, 20], maxZoom: 15 });
          forceTileRedraw(mapInstance);
        } catch (e) { console.warn("fitBounds in onMapCreated failed", e); }
      }
    }, 120);
  }, [combinedGeojson]);

  const isBlobLike = (v: any): v is Blob =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as any).arrayBuffer === "function" &&
  typeof (v as any).size === "number" &&
  typeof (v as any).type === "string";

  // small effect to log mapRef for debug
  useEffect(() => {
    const id = setInterval(() => {
      if (mapRef.current) {
        console.log("[TrackUploader] mapRef is set:", mapRef.current);
        clearInterval(id);
      }
    }, 200);
    setTimeout(() => clearInterval(id), 5000);
    return () => clearInterval(id);
  }, []);

  // image input change handler (local preview) — UPDATED to match TrackDetail behavior:
    const onImageInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files) return;
  const incoming = Array.from(e.target.files);

  // clear existing markers for a fresh start
  clearImageMarkers();

  // We'll build two arrays: filesToUpload and previewUrls
  const finalFiles: File[] = [];
  const previewUrls: string[] = [];

  // compute current route extent for containment checks
  const extent = getCombinedExtentFromDayTracks(dayTracks); // may be null

  for (let idx = 0; idx < incoming.length; idx++) {
    const f = incoming[idx];
    try {
      // 1) extract EXIF from original file BEFORE any conversion (best-effort)
      let gps: LatLon = null;
      try {
        if (typeof extractExifFromFile === "function") {
          gps = await extractExifFromFile(f);
        } else {
          gps = null;
        }
        console.debug("[onImageInputChange] extracted gps from original", { name: f.name, gps });
        if (gps && extent && extent.bbox) {
          const [minLon, minLat, maxLon, maxLat] = extent.bbox as [number, number, number, number];
          if (gps.lon >= minLon && gps.lon <= maxLon && gps.lat >= minLat && gps.lat <= maxLat) {
            // show a quick marker from the original file so the user sees it immediately
            try {
              const markerPreviewUrl = URL.createObjectURL(f);
              const marker = await addMarker(gps.lat, gps.lon, markerPreviewUrl, { title: f.name, previewSize: 140 });
              if (marker) markersRef.current.push(marker);
              // NOTE: we don't revoke markerPreviewUrl here because marker preview may use it;
              // push marker preview into previews so user sees something immediately
              previewUrls.push(markerPreviewUrl);
            } catch (e) {
              console.warn("[onImageInputChange] failed to add marker from extracted EXIF:", e);
            }
          }
        }
      } catch (exifErr) {
        // non-fatal: extraction may fail for some images
        console.warn("[onImageInputChange] extractExifFromFile failed for", f.name, exifErr);
        gps = null;
      }

      // 2) convert HEIC -> JPEG if needed, else keep original
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      if (ext === "heic" || ext === "heif") {
        try {
          // use converter directly (returns file/blob or convert result)
          const convRes: any = await convertHeicFile(f, { type: "image/jpeg", quality: 0.92 });
          const out = convRes?.file ?? convRes;
          let convertedBlob: Blob;
          if (isBlobLike(out) || out instanceof File) {
            convertedBlob = out as Blob;
          } else {
            throw new Error("convertHeicFile returned unsupported value");
          }

          // insert GPS EXIF into converted JPEG (if we have gps)
          let patchedBlob: Blob = convertedBlob;
          if (gps && typeof gps.lat === "number" && typeof gps.lon === "number" && typeof insertGpsExifIntoJpeg === "function") {
            try {
              patchedBlob = await insertGpsExifIntoJpeg(convertedBlob, gps);
            } catch (e) {
              console.warn("[onImageInputChange] insertGpsExifIntoJpeg failed", e);
            }
          }

          const filenameBase = (f.name || "image").replace(/\.[^.]+$/, "");
          const finalFile =
            patchedBlob instanceof File
              ? patchedBlob
              : new File([patchedBlob], `${filenameBase}.jpg`, { type: "image/jpeg" });

          finalFiles.push(finalFile);
          try { previewUrls.push(URL.createObjectURL(finalFile)); } catch { previewUrls.push(""); }
        } catch (convErr) {
          console.warn(
            "[onImageInputChange] HEIC conversion or EXIF insert failed, falling back to original",
            convErr
          );
          finalFiles.push(f);
          try {
            previewUrls.push(URL.createObjectURL(f));
          } catch {
            previewUrls.push("");
          }
        }
      } else {
        // not HEIC — keep as-is (may already contain EXIF)
        finalFiles.push(f);
        try { previewUrls.push(URL.createObjectURL(f)); } catch { previewUrls.push(""); }
      }
    } catch (err) {
      console.warn("[onImageInputChange] per-file error", err);
    }
  }

  // revoke previous previews
  imagePreviews.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });

  // set states
  setImageFiles(finalFiles);
  setImagePreviews(previewUrls);

  // clear native input to allow re-selecting same file
  e.target.value = "";
}, [imagePreviews, dayTracks]);



  // image modal handlers
  const openModalAt = useCallback((idx: number) => {
    setModalIndex(idx);
    setModalOpen(true);
  }, []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const nextModal = useCallback(() => setModalIndex((i) => Math.min(i + 1, imagePreviews.length - 1)), [imagePreviews.length]);
  const prevModal = useCallback(() => setModalIndex((i) => Math.max(i - 1, 0)), []);

  // ---- RENDER ----
  return (
    <div style={{ display: "flex", gap: 20 }}>
      <Toast message={toastMsg} show={toastShow} onClose={() => setToastShow(false)} />

      {/* left: controls */}
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
            onFiles={(filesOrList) => { handleFiles(filesOrList); }}
            buttonLabel="Choose GPX files"
          />
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) fileInputRef.current.click();
              else openNativePicker();
            }}
            aria-label="Upload GPX or KML files"
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
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
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My multi-day hike title..." className="border p-2 rounded w-full" />
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontWeight: 600 }}>Description (Markdown)</label>
          <MarkdownEditor
            value={descriptionMd}
            onChange={setDescriptionMd}
            editable={true}
            defaultLayout="split"
            rows={8}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontWeight: 600 }}>Images</label>
          <input type="file" accept="image/*" multiple onChange={onImageInputChange} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {imagePreviews.map((src, i) => (
              <div key={i} style={{ width: 120, height: 80, overflow: "hidden", borderRadius: 6, border: "1px solid #eee", cursor: "pointer" }} onClick={() => openModalAt(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`preview-${i}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={saveAll} disabled={!dayTracks.length || state === "saving"}>Save hike</button>
          <button onClick={clearAll} disabled={!dayTracks.length}>Clear</button>
          <button onClick={() => addDemoMarkerAtCenter()} className="ml-auto">Add demo marker</button>
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

        <div ref={wrapperRef} style={{ height: 480, borderRadius: 6, overflow: "hidden", border: "1px solid #eee", position: "relative" }}>
          {!RL ? (
            <div style={{ padding: 20 }}>Loading map…</div>
          ) : (
            // @ts-ignore
            <RL.MapContainer
              whenCreated={(map: any) => { onMapCreated(map); }}
              style={{ height: "100%", width: "100%", position: "absolute", left: 0, top: 0 }}
              center={[-41.17, 174.09]}
              zoom={10}
              scrollWheelZoom={true}
            >
              <MapSetter onReady={onMapCreated} />
              {/* @ts-ignore */}
              <RL.TileLayer key={activeTileId} url={TILE_LAYERS.find((t) => t.id === activeTileId)!.url} {...(TILE_LAYERS.find((t) => t.id === activeTileId)!.options || {})} />

              {combinedGeojson && (
                // @ts-ignore
                <RL.GeoJSON data={combinedGeojson} style={() => ({ color: "#ff5722", weight: 4, opacity: 0.30 })} />
              )}

              {dayTracks.map((d) => d.visible && (
                // @ts-ignore
                <RL.GeoJSON
                  key={d.id}
                  data={d.geojson}
                  style={() => ({ color: d.color, weight: 5, opacity: 1.0 })}
                  // @ts-ignore
                  pointToLayer={(_feature: any, latlng: any) => RL.circleMarker(latlng, { radius: 5, fill: true, fillOpacity: 0.9, color: d.color, weight: 1, opacity: 0.95 })}
                />
              ))}
            </RL.MapContainer>
          )}
        </div>

        {/* extents & stats */}
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

      {/* image modal */}
      {modalOpen && (
        <div style={{
          position: "fixed", left: 0, top: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.6)", zIndex: 20000,
        }}>
          <div style={{ width: "90%", maxWidth: 1000, background: "#fff", borderRadius: 8, overflow: "hidden", position: "relative" }}>
            <div style={{ padding: 8, display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={prevModal} disabled={modalIndex === 0}>◀</button>
              <div style={{ flex: 1, textAlign: "center", fontWeight: 600 }}>{modalIndex + 1} / {imagePreviews.length}</div>
              <a href={imagePreviews[modalIndex]} target="_blank" rel="noreferrer" className="px-2 py-1 border rounded">Open</a>
              <a href={imagePreviews[modalIndex]} download className="px-2 py-1 border rounded">Download</a>
              <button onClick={closeModal}>Close</button>
            </div>
            <div style={{ background: "#000", display: "flex", alignItems: "center", justifyContent: "center", height: 640 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreviews[modalIndex]} alt={`img-${modalIndex}`} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
