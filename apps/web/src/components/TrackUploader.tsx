"use client";

import React, { JSX, useCallback, useEffect, useRef, useState } from "react";
import type {
  FeatureCollection,
  Geometry,
  Position,
} from "geojson";
import * as turf from "@turf/turf";
import { getAuth } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { gpx as parseGpx, kml as parseKml } from "togeojson";
import type { Map as LeafletMap } from "leaflet";

type Props = {
  onFiles: (files: FileList | File[]) => void;
};

/**
 * Multi-file TrackUploader
 * - supports multiple GPX/KML files
 * - displays each day's track in a different color
 * - displays a combined "full hike" overlay
 *
 * Notes: this reuses the robust map logic (react-leaflet dynamic import + direct fallback) you already had.
 */

// ----- Types -----
type DayTrack = {
  id: string;
  name: string;
  geojson: FeatureCollection<Geometry>;
  stats: {
    distance_m: number;
    elevation: { min: number; max: number } | null;
    bounds: [number, number, number, number] | null;
  };
  color: string;
  visible: boolean;
};

type UploadState = "idle" | "parsing" | "preview" | "saving" | "saved" | "error";

// simple palette - expand if you expect > 8 days
const PALETTE = ["#e74c3c", "#f39c12", "#27ae60", "#2980b9", "#8e44ad", "#c0392b", "#d35400", "#16a085"];

// ----- Component -----
export default function TrackUploader(): JSX.Element {
  const [RL, setRL] = useState<any | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [dayTracks, setDayTracks] = useState<DayTrack[]>([]);
  const [combinedGeojson, setCombinedGeojson] = useState<FeatureCollection<Geometry> | null>(null);
  const [combinedStats, setCombinedStats] = useState<{ distance_m: number; elevation: { min:number; max:number } | null; bounds: [number,number,number,number] | null } | null>(null);

  const [fileNameList, setFileNameList] = useState<string[]>([]);
  const mapRef = useRef<LeafletMap | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [directFallback, setDirectFallback] = useState(false);
  const directDivId = "direct-leaflet-fallback";
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // dynamic import react-leaflet
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;
    import("react-leaflet")
      .then((mod) => { if (mounted) setRL(mod); })
      .catch((err) => console.error("react-leaflet dynamic import failed:", err));
    return () => { mounted = false; };
  }, []);

  // ensure the runtime DOM property/attribute is set (defensive)
useEffect(() => {
  if (fileInputRef.current) {
    // Force both the DOM property and the attribute to be true
    fileInputRef.current.multiple = true;
    fileInputRef.current.setAttribute("multiple", "");
  }
}, []);

  // helper: compute stats for a FeatureCollection (distance, elevation, bbox)
  function computeStats(fc: FeatureCollection<Geometry>) {
    let total = 0;
    const elev: number[] = [];
    try {
      for (const f of fc.features) {
        const g = f.geometry as any;
        if (!g) continue;
        // turf.length works with Feature objects; create Feature wrappers
        total += turf.length(f as any, { units: "kilometers" }) * 1000;
        // collect elevation values if present
        if (g.coordinates) {
          const coords = ((): Position[] => {
            if (g.type === "LineString") return g.coordinates as Position[];
            if (g.type === "MultiLineString") return ([] as Position[]).concat(...(g.coordinates as Position[][]));
            return [];
          })();
          for (const p of coords) if (p && p.length > 2 && typeof p[2] === "number") elev.push(p[2]);
        }
      }
    } catch (e) {
      // turf can throw on degenerate geometry — ignore
    }

    let bounds: [number, number, number, number] | null = null;
    try {
      bounds = turf.bbox(fc) as [number, number, number, number];
    } catch {
      bounds = null;
    }

    return {
      distance_m: Math.round(total),
      elevation: elev.length ? { min: Math.min(...elev), max: Math.max(...elev) } : null,
      bounds,
    };
  }

  // merge all day FeatureCollections into one FeatureCollection
  function mergeDayGeoJSON(days: DayTrack[]) {
    const features = days.flatMap(d => d.geojson.features);
    return { type: "FeatureCollection", features } as FeatureCollection<Geometry>;
  }

  // basic forceTileRedraw same as earlier (keeps tiles correctly positioned)
  function forceTileRedraw(map: any) {
    if (!map) return;
    try {
      if (wrapperRef.current) {
        const r = wrapperRef.current.getBoundingClientRect();
        wrapperRef.current.style.width = `${Math.round(r.width)}px`;
        wrapperRef.current.style.height = `${Math.round(r.height)}px`;
        wrapperRef.current.style.overflow = "hidden";
      }
      try { map.invalidateSize(true); } catch {}
      setTimeout(() => { try { map.invalidateSize(true); } catch {} }, 120);

      map.eachLayer((layer: any) => {
        try {
          if (typeof layer.redraw === "function") layer.redraw();
          if (typeof layer.setUrl === "function" && layer._url) layer.setUrl(layer._url);
        } catch (e) {}
      });

      setTimeout(() => {
        try {
          map.invalidateSize(true);
          map.eachLayer((layer: any) => {
            try { if (typeof layer.redraw === "function") layer.redraw(); } catch (e) {}
          });
        } catch (e) {}
        if (wrapperRef.current) {
          wrapperRef.current.style.width = "";
          wrapperRef.current.style.height = "";
          wrapperRef.current.style.overflow = "";
        }
      }, 500);
    } catch (e) { console.warn(e); }
  }

  // onMapCreated
  const onMapCreated = useCallback((mapInstance: LeafletMap) => {
    mapRef.current = mapInstance;
    // expose for debugging
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
        } catch (e) {}
      }
    }, 200);

    // optional gentle wheel handler
    try {
      const el = mapInstance.getContainer();
      try { el.removeEventListener("wheel", (el as any)._wheelHandler); } catch {}
      const handler = (e: WheelEvent) => {
        e.preventDefault();
        const raw = e.deltaY;
        const step = 0.45;
        const sign = Math.sign(raw);
        const newZoom = mapInstance.getZoom() - sign * step;
        const clamped = Math.max(mapInstance.getMinZoom(), Math.min(mapInstance.getMaxZoom(), newZoom));
        mapInstance.setZoom(clamped);
      };
      (el as any)._wheelHandler = handler;
      el.addEventListener("wheel", handler, { passive: false });
    } catch (e) {}

    // cleanup is not strictly required in caller context
  }, [combinedGeojson]);

  // wait for map helper
  async function waitForMap(timeoutMs = 5000, intervalMs = 200) {
    const start = Date.now();
    return new Promise<LeafletMap | null>((resolve) => {
      const iv = window.setInterval(() => {
        if (mapRef.current) {
          clearInterval(iv);
          resolve(mapRef.current);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          resolve(null);
        }
      }, intervalMs);
    });
  }

  // direct fallback creation (keeps old behavior)
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
      } catch (e) {}
    })();
    return () => { try { if (directMap) directMap.remove(); } catch {} };
  }, [directFallback, combinedGeojson]);

  // -----------------------------
  // FILE PARSING: handle multiple files
  // -----------------------------
  const handleFiles = useCallback(async (files: FileList | null) => {
    setError(null);
    if (!files || files.length === 0) return;
    setState("parsing");

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

        let gjson;
        if (ext === "gpx") gjson = parseGpx(xml);
        else if (ext === "kml") gjson = parseKml(xml);
        else {
          if (text.trim().startsWith("<")) gjson = parseGpx(xml);
          else throw new Error("Unsupported file type (use .gpx or .kml)");
        }

        const stats = computeStats(gjson);
        const color = PALETTE[parsedDays.length % PALETTE.length];
        const day: DayTrack = {
          id: `${Date.now()}-${i}`,
          name: f.name,
          geojson: gjson,
          stats: { distance_m: stats.distance_m, elevation: stats.elevation, bounds: stats.bounds },
          color,
          visible: true,
        };
        parsedDays.push(day);
      }

      // set state: days, combined, stats
      setDayTracks(parsedDays);
      setFileNameList(names);

      // combined
      const combined = mergeDayGeoJSON(parsedDays);
      setCombinedGeojson(combined);
      const combinedStats = computeStats(combined);
      setCombinedStats({ distance_m: combinedStats.distance_m, elevation: combinedStats.elevation, bounds: combinedStats.bounds });

      // try to fit bounds on existing map
      if (combinedStats.bounds) {
        const [minX, minY, maxX, maxY] = combinedStats.bounds;
        const b: [[number, number], [number, number]] = [[minY, minX], [maxY, maxX]];
        // if map exists, fit now
        const map = mapRef.current;
        if (map) {
          try {
            map.invalidateSize();
            map.fitBounds(b as any, { padding: [20, 20], maxZoom: 15 });
            forceTileRedraw(map);
          } catch (e) {
            // if map not ready, wait for it
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

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  // toggle visibility of a day track
  const toggleDayVisible = useCallback((id: string) => {
    setDayTracks((prev) => prev.map(d => d.id === id ? { ...d, visible: !d.visible } : d));
  }, []);

  // save all day tracks to Firestore under a group doc
  const saveAll = useCallback(async () => {
    setState("saving");
    setError(null);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in to save");

      const payload = {
        title: `Multi-day hike: ${fileNameList.join(", ")}`,
        createdAt: serverTimestamp(),
        days: dayTracks.map(d => ({ name: d.name, geojson: d.geojson, stats: d.stats })),
        combined: combinedGeojson,
      };

      await addDoc(collection(db, "users", user.uid, "hikes"), payload);
      setState("saved");
    } catch (err) {
      console.error("save error", err);
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [dayTracks, combinedGeojson, fileNameList]);

  // remove/clear
  const clearAll = useCallback(() => {
    setDayTracks([]);
    setCombinedGeojson(null);
    setCombinedStats(null);
    setFileNameList([]);
    setState("idle");
  }, []);

  // RENDER
  return (
    <div style={{ display: "flex", gap: 20 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDrop={onDrop}
        style={{
          border: "2px dashed #ddd",
          borderRadius: 8,
          padding: 20,
          width: 360,
          minHeight: 200,
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
          accept=".gpx,.kml"
          onChange={onFileChange}
          // you can keep multiple here too; explicit boolean avoids ambiguity
          multiple={true}
        />
        <div style={{ marginTop: 8 }}>
          <small>Status: {state}</small>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong>Files</strong>
          {fileNameList.length === 0 ? (<div style={{ color: "#777", marginTop: 8 }}>No files selected</div>) :
            <ol>
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
          }
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={saveAll} disabled={!dayTracks.length || state === "saving"}>Save hike</button>
          <button onClick={clearAll} disabled={!dayTracks.length}>Clear</button>
        </div>
        {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>Preview</strong>
          {fileNameList.length > 0 && <span style={{ marginLeft: 12, color: "#666" }}>{fileNameList.join(", ")}</span>}
        </div>

        <div ref={wrapperRef} style={{ height: 420, borderRadius: 6, overflow: "hidden", border: "1px solid #eee", position: "relative" }}>
          {directFallback ? (
            <div id={directDivId} style={{ height: "100%", width: "100%" }} />
          ) : !RL ? (
            <div style={{ padding: 20 }}>Loading map…</div>
          ) : (
            // @ts-ignore - RL is dynamically imported module
            <RL.MapContainer whenCreated={onMapCreated} style={{ height: "100%", width: "100%", position: "absolute", left: 0, top: 0 }} center={[-41.17, 174.09]} zoom={10} scrollWheelZoom={true}>
              {/* @ts-ignore */}
              <RL.TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" tileSize={256} detectRetina={false} />
              {/* render per-day tracks with colors */}
              {dayTracks.map((d) => d.visible && (
                // @ts-ignore
                <RL.GeoJSON key={d.id} data={d.geojson} style={{ color: d.color, weight: 4, opacity: 0.9 }} />
              ))}
              {/* combined overlay (thicker, semi-opaque) */}
              {combinedGeojson && (
                // @ts-ignore
                <RL.GeoJSON data={combinedGeojson} style={{ color: "#ff5722", weight: 6, opacity: 0.7 }} />
              )}
            </RL.MapContainer>
          )}
        </div>

        {/* stats */}
        {combinedStats && (
          <div style={{ marginTop: 12 }}>
            <div><strong>Total distance:</strong> {(combinedStats.distance_m / 1000).toFixed(2)} km</div>
            {combinedStats.elevation && <div><strong>Elevation:</strong> {Math.round(combinedStats.elevation.min)}–{Math.round(combinedStats.elevation.max)} m</div>}
            {combinedStats.bounds && <div><strong>Bounds:</strong> {combinedStats.bounds.join(", ")}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
