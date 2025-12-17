"use client";

import React, { JSX, useCallback, useEffect, useRef, useState } from "react";
import type { FeatureCollection, Geometry, Position } from "geojson";
import * as turf from "@turf/turf";
import { getAuth } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { gpx as parseGpx, kml as parseKml } from "togeojson";
import type { Map as LeafletMap } from "leaflet";
import ClientFileInput from "@/app/hikes/components/ClientFileInput"; // ensure this exists (client-only picker)

/**
 * TrackUploader - multi-file GPX/KML uploader and preview
 * - multiple files (via ClientFileInput and drag/drop)
 * - basemap selection
 * - compute combined extents and auto-fit
 * - per-day layers + combined overlay
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

// ----- Palette & Tile layers -----
const PALETTE = ["#e74c3c", "#f39c12", "#27ae60", "#2980b9", "#8e44ad", "#c0392b", "#d35400", "#16a085"];

const TILE_LAYERS = [
  { id: "osm", name: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", options: { maxZoom: 19, tileSize: 256 } },
  { id: "opentopo", name: "OpenTopoMap", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", options: { maxZoom: 17, tileSize: 256 } },
  { id: "stamen-toner", name: "Stamen Toner", url: "https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png", options: { maxZoom: 20, tileSize: 256 } },
];

// ----- Component -----
export default function TrackUploader(): JSX.Element {
  const [RL, setRL] = useState<any | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [dayTracks, setDayTracks] = useState<DayTrack[]>([]);
  const [combinedGeojson, setCombinedGeojson] = useState<FeatureCollection<Geometry> | null>(null);
  const [combinedStats, setCombinedStats] = useState<{ distance_m: number; elevation: { min:number; max:number } | null; bounds: [number,number,number,number] | null } | null>(null);
  const [fileNameList, setFileNameList] = useState<string[]>([]);

  const [activeTileId, setActiveTileId] = useState<string>(TILE_LAYERS[0].id);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const [directFallback, setDirectFallback] = useState(false);
  const directDivId = "direct-leaflet-fallback";

  // dynamic import react-leaflet
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;
    import("react-leaflet")
      .then((mod) => { if (mounted) setRL(mod); })
      .catch((err) => console.error("react-leaflet dynamic import failed:", err));
    return () => { mounted = false; };
  }, []);

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
    } catch (e) { console.warn("forceTileRedraw error", e); }
  }

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

    // gentle wheel handler
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
  }, [combinedGeojson]);

  async function waitForMap(timeoutMs = 5000, intervalMs = 200) {
    const start = Date.now();
    return new Promise<LeafletMap | null>((resolve) => {
      const iv = window.setInterval(() => {
        if (mapRef.current) { clearInterval(iv); resolve(mapRef.current); }
        else if (Date.now() - start > timeoutMs) { clearInterval(iv); resolve(null); }
      }, intervalMs);
    });
  }

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
      } catch (e) { console.error("direct fallback failed", e); }
    })();
    return () => { try { if (directMap) directMap.remove(); } catch {} };
  }, [directFallback, combinedGeojson]);

  // ----- FILE PARSING (robust for multiple files) -----
  const handleFiles = useCallback(async (filesOrList: FileList | File[] | null) => {
    console.log("ENTER handleFiles", filesOrList);

    setError(null);
    console.log(filesOrList)
    if (!filesOrList) return;
    setState("parsing");

    const files: File[] = (filesOrList as FileList).item ? Array.from(filesOrList as FileList) : (filesOrList as File[]);
    console.log("DEBUG handleFiles - incoming files:", files.map(f => f.name));

    if (files.length === 0) { setState("idle"); return; }

    try {
      const parsedDays: DayTrack[] = [];
      const names: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        names.push(f.name);
        console.log(`DEBUG parsing file ${i}:`, f.name);
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
          // convert <wpt> to point features if present
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
            console.log(`DEBUG: file ${f.name} had ${wptFeatures.length} waypoints — converted to Point features.`);
          }
        }

        const stats = computeStats(gjson);
        const color = PALETTE[parsedDays.length % PALETTE.length] ?? "#3388ff";
        const day: DayTrack = {
          id: `${Date.now()}-${i}`,
          name: f.name,
          geojson: gjson,
          stats: { distance_m: stats.distance_m, elevation: stats.elevation, bounds: stats.bounds },
          color,
          visible: true,
        };

        parsedDays.push(day);
        console.log(`DEBUG parsed ${f.name}: features=${gjson.features ? gjson.features.length : 0} distance_m=${stats.distance_m}`);
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

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // native picker wrapper (not required when using ClientFileInput, but kept for backward compat)
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
    // fallback: do nothing here — ClientFileInput handles it
  }, [handleFiles]);

  const toggleDayVisible = useCallback((id: string) => {
    setDayTracks(prev => prev.map(d => d.id === id ? { ...d, visible: !d.visible } : d));
  }, []);

  const clearAll = useCallback(() => {
    setDayTracks([]); setCombinedGeojson(null); setCombinedStats(null); setFileNameList([]); setState("idle");
  }, []);

  const saveAll = useCallback(async () => {
    setState("saving"); setError(null);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in to save");
      const ext = getCombinedExtentFromDayTracks(dayTracks);
      const payload = {
        title: `Multi-day hike: ${fileNameList.join(", ")}`,
        createdAt: serverTimestamp(),
        days: dayTracks.map(d => ({ name: d.name, geojson: d.geojson, stats: d.stats })),
        combined: combinedGeojson,
        extents: ext ? { bbox: ext.bbox, sw: ext.sw, ne: ext.ne, center: ext.center } : null,
      };
      await addDoc(collection(db, "users", user.uid, "hikes"), payload);
      setState("saved");
    } catch (err) {
      console.error("save error", err);
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [dayTracks, combinedGeojson, fileNameList]);

  // ----- EXTENT helpers & auto-fit -----
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
    console.log('dayTracks changed, fitting to extent:', dayTracks.map(d=>d.name), ext);
    if (!ext || !mapRef.current) return;
    try {
      (mapRef.current as any).fitBounds([ext.sw, ext.ne], { padding: [24, 24], maxZoom: 16 });
      forceTileRedraw(mapRef.current);
    } catch (e) { console.warn("fitBounds failed:", e); }
  }, [dayTracks]);

  // ----- RENDER -----
  return (
    <div style={{ display: "flex", gap: 20 }}>
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
        <div style={{ marginBottom: 8 }}>
          {/* client-only picker ensures the DOM input supports multiple */}
          <ClientFileInput
            onFiles={(filesOrList) => {
              console.log("ClientFileInput -> onFiles called, filesOrList:", filesOrList);
              // normalize FileList|File[] to File[]
              const filesArray: File[] = (filesOrList && (filesOrList as FileList).item) ? Array.from(filesOrList as FileList) : (filesOrList as File[]);
              console.log("ClientFileInput -> normalized filesArray:", filesArray?.map(f=>f.name));
              // call your existing handler
              handleFiles(filesOrList);
            }}
            buttonLabel="Choose GPX files"
          />

        </div>

        <div style={{ marginTop: 8 }}>
          <small>Status: {state}</small>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong>Files</strong>
          {fileNameList.length === 0 ? (
            <div style={{ color: "#777", marginTop: 8 }}>No files selected — drag & drop multiple GPX/KML files here, or click Choose GPX files.</div>
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

        {/* basemap controls */}
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
          {directFallback ? (
            <div id={directDivId} style={{ height: "100%", width: "100%" }} />
          ) : !RL ? (
            <div style={{ padding: 20 }}>Loading map…</div>
          ) : (
            // @ts-ignore - RL is dynamic module
            <RL.MapContainer whenCreated={onMapCreated} style={{ height: "100%", width: "100%", position: "absolute", left: 0, top: 0 }} center={[-41.17, 174.09]} zoom={10} scrollWheelZoom={true}>
              {/* @ts-ignore */}
              <RL.TileLayer key={activeTileId} url={TILE_LAYERS.find(t => t.id === activeTileId)!.url} {...(TILE_LAYERS.find(t => t.id === activeTileId)!.options || {})} />
              {dayTracks.map(d => d.visible && (
                // @ts-ignore
                <RL.GeoJSON key={d.id} data={d.geojson} style={{ color: d.color, weight: 4, opacity: 0.95 }} />
              ))}
              {combinedGeojson && (
                // @ts-ignore
                <RL.GeoJSON data={combinedGeojson} style={{ color: "#ff5722", weight: 6, opacity: 0.75 }} />
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
