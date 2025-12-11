"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  Position,
} from "geojson";
import * as turf from "@turf/turf";
import { getAuth } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { gpx as parseGpx, kml as parseKml } from "togeojson";
import type { Map as LeafletMap } from "leaflet";

type TrackStats = {
  distance_m: number;
  bounds: [number, number, number, number] | null;
  elevation: { min: number; max: number } | null;
};

type UploadState = "idle" | "parsing" | "preview" | "saving" | "saved" | "error";

export default function TrackUploader(): JSX.Element {
  const [RL, setRL] = useState<any | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [geojson, setGeojson] = useState<FeatureCollection<Geometry> | null>(null);
  const [stats, setStats] = useState<TrackStats | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<[[number, number], [number, number]] | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);

  // direct fallback control
  const [directFallback, setDirectFallback] = useState(false);
  const directDivId = "direct-leaflet-fallback";

  // dynamic load react-leaflet once
  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;
    import("react-leaflet")
      .then((mod) => { if (mounted) setRL(mod); })
      .catch((err) => console.error("react-leaflet dynamic import failed:", err));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    console.log("TrackUploader mounted. RL loaded?:", !!RL);
  }, [RL]);

  // helper: force tile redraw + reload
  function forceTileRedraw(map: any) {
    if (!map) return;
    try {
      // immediate invalidate
      try { map.invalidateSize(true); } catch (e) {}
      setTimeout(() => { try { map.invalidateSize(true); } catch (e) {} }, 120);

      // redraw / refresh tile layers and re-set url if possible
      map.eachLayer((layer: any) => {
        try {
          if (typeof layer.redraw === "function") layer.redraw();
          if (typeof layer.setUrl === "function" && layer._url) {
            // reassign same url to force reload
            layer.setUrl(layer._url);
          }
        } catch (e) {}
      });

      // second sweep after tiles may have been requested
      setTimeout(() => {
        try {
          map.invalidateSize(true);
          map.eachLayer((layer: any) => {
            try { if (typeof layer.redraw === "function") layer.redraw(); } catch (e) {}
          });
        } catch (e) {}
      }, 500);
    } catch (e) {
      console.warn("forceTileRedraw error", e);
    }
  }

  // map onCreate
  const onMapCreated = useCallback((mapInstance: LeafletMap) => {
    mapRef.current = mapInstance;
    // @ts-ignore
    window._fortAmazingMap = mapInstance;
    console.log("DEBUG: react-leaflet Map instance created");

    setTimeout(() => {
      try { mapInstance.invalidateSize(); } catch {}
    }, 200);

    if (mapBounds) {
      try {
        console.log("DEBUG: onMapCreated fitBounds ->", mapBounds);
        mapInstance.fitBounds(mapBounds as any, { padding: [20, 20], maxZoom: 15 });
        // ensure tiles redraw after fitBounds
        forceTileRedraw(mapInstance);
      } catch (e) {}
    }
  }, [mapBounds]);

  // waitForMap helper
  async function waitForMap(timeoutMs = 5000, intervalMs = 200): Promise<LeafletMap | null> {
    const start = Date.now();
    return new Promise((resolve) => {
      const iv = window.setInterval(() => {
        const map = mapRef.current;
        // diagnostic
        // console.log("waitForMap:", !!map, "elapsed:", Date.now() - start);
        if (map) {
          clearInterval(iv);
          resolve(map);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          resolve(null);
        }
      }, intervalMs);
    });
  }

  // fallback toggler: if RL loaded but no map instance in 3.5s, enable direct fallback
  useEffect(() => {
    if (!RL) return;
    const timer = window.setTimeout(() => {
      if (!mapRef.current) {
        console.warn("react-leaflet map instance not created — enabling direct Leaflet fallback");
        setDirectFallback(true);
      }
    }, 3500);
    return () => clearTimeout(timer);
  }, [RL]);

  // direct fallback effect: create plain Leaflet into div and draw geojson
  useEffect(() => {
    if (!directFallback) return;
    let directMap: any = null;

    (async () => {
      try {
        const Lmod = await import("leaflet");
        const L: any = (Lmod as any).default ? (Lmod as any).default : Lmod;

        const cssPresent = [...document.styleSheets].some((s) => s.href && s.href.includes("leaflet"));
        console.log("direct-leaflet: leaflet css present?", cssPresent);

        const el = document.getElementById(directDivId);
        if (!el) {
          console.warn("direct-leaflet: fallback div not found");
          return;
        }

        directMap = L.map(el).setView([-41.17, 174.09], 10);
        const tl = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, tileSize: 256, detectRetina: false }).addTo(directMap);

        if (geojson) {
          const gj = L.geoJSON(geojson as any, { style: { color: "#ff5722", weight: 4 } }).addTo(directMap);
          try { directMap.fitBounds(gj.getBounds(), { padding: [20, 20] }); } catch {}
        } else if (mapBounds) {
          try { directMap.fitBounds(mapBounds as any, { padding: [20, 20] }); } catch {}
        }

        // force tile redraw
        forceTileRedraw(directMap);

        // expose for debug
        // @ts-ignore
        window._directLeaflet = directMap;
        console.log("direct-leaflet: created", !!window._directLeaflet);
      } catch (err) {
        console.error("direct-leaflet: failed to create", err);
      }
    })();

    return () => {
      try { if (directMap) directMap.remove(); } catch {}
      // @ts-ignore
      if (window._directLeaflet) delete (window as any)._directLeaflet;
    };
  }, [directFallback, geojson, mapBounds]);

  // retryer when mapBounds changes (applies to react-leaflet mapRef)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapBounds) return;

    let cancelled = false;
    const delays = [150, 500, 1000];

    const attempt = (i: number) => {
      if (cancelled) return;
      try {
        console.log(`Retry fitBounds attempt ${i + 1}`);
        map.invalidateSize();
        map.fitBounds(mapBounds as any, { padding: [20, 20], maxZoom: 15 });
        // ensure tiles redraw
        forceTileRedraw(map);
      } catch (e) {}

      setTimeout(() => {
        if (cancelled) return;
        try {
          const center = map.getCenter();
          if (center.lat < -30 && center.lat > -50) {
            console.log("Retry succeeded — center is NZ:", center);
            return;
          }
        } catch (e) {}

        if (i + 1 < delays.length) attempt(i + 1);
        else {
          const [sw, ne] = mapBounds;
          const cLat = (sw[0] + ne[0]) / 2;
          const cLng = (sw[1] + ne[1]) / 2;
          try { map.setView([cLat, cLng], 12); forceTileRedraw(map); } catch {}
        }
      }, delays[i]);
    };

    attempt(0);
    return () => { cancelled = true; };
  }, [mapBounds]);

  // parsing + handleFiles
  const handleFiles = useCallback(async (files: FileList | null) => {
    setError(null);
    if (!files?.length) return;
    setState("parsing");
    const file = files[0];
    setFileName(file.name);

    try {
      const text = await file.text();
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");

      let gjson: FeatureCollection<Geometry>;
      if (ext === "gpx") gjson = parseGpx(xml);
      else if (ext === "kml") gjson = parseKml(xml);
      else {
        if (text.trim().startsWith("<")) gjson = parseGpx(xml);
        else throw new Error("Unsupported file type. Use .gpx or .kml");
      }

      const computed = computeTrackStats(gjson);
      // debug
      // @ts-ignore
      window._lastGeoJSON = gjson;

      setGeojson(gjson);
      setStats(computed);

      if (computed.bounds) {
        const [minX, minY, maxX, maxY] = computed.bounds;
        const b: [[number, number], [number, number]] = [[minY, minX], [maxY, maxX]];
        setMapBounds(b);

        const map = mapRef.current;
        if (map) {
          try {
            console.log("DEBUG: immediate fitBounds ->", b);
            map.invalidateSize();
            map.fitBounds(b as any, { padding: [20, 20], maxZoom: 15 });
            forceTileRedraw(map);
            setState("preview");
            return;
          } catch (e) {
            console.warn("Immediate fitBounds failed:", e);
          }
        }

        // wait for map and force center/redraw if created
        (async () => {
          const waited = await waitForMap(5000, 200);
          if (waited) {
            try {
              console.log("DEBUG: FORCE setView after wait");
              const [sw, ne] = b;
              const centerLat = (sw[0] + ne[0]) / 2;
              const centerLng = (sw[1] + ne[1]) / 2;
              waited.setView([centerLat, centerLng], 12);
              waited.invalidateSize();
              forceTileRedraw(waited);
            } catch (err) {
              console.warn("force setView failed", err);
            }
          } else {
            console.warn("Map never became ready — enabling direct fallback if not already");
            setDirectFallback(true);
          }
        })();
      }

      setState("preview");
    } catch (err) {
      console.error("parse error:", err);
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

  const saveToFirestore = useCallback(async () => {
    setState("saving");
    setError(null);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("You must be signed in to save tracks.");
      if (!geojson) throw new Error("No track loaded.");

      const payload = {
        name: fileName ?? "uploaded-track",
        createdAt: serverTimestamp(),
        geojson,
        metadata: stats,
      };

      await addDoc(collection(db, "users", user.uid, "tracks"), payload);
      setState("saved");
    } catch (err) {
      console.error("save error", err);
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [geojson, stats, fileName]);

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
          justifyContent: "center",
          alignItems: "center",
          background: state === "parsing" ? "#fafafa" : "white",
        }}
      >
        <input type="file" accept=".gpx,.kml" onChange={onFileChange} />
        <div style={{ marginTop: 8 }}>
          <small>Status: {state}</small>
        </div>
        {error && <div style={{ marginTop: 8, color: "red" }}>{error}</div>}
        {state === "preview" && (
          <div style={{ marginTop: 12 }}>
            <button onClick={saveToFirestore} disabled={state === "saving"}>Save to my account</button>
          </div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>Preview</strong>
          {fileName && <span style={{ marginLeft: 12, color: "#666" }}>{fileName}</span>}
        </div>

        <div style={{ height: 420, borderRadius: 6, overflow: "hidden", border: "1px solid #eee" }}>
          {directFallback ? (
            <div id={directDivId} style={{ height: "100%", width: "100%" }} />
          ) : !RL ? (
            <div style={{ padding: 20 }}>Loading map…</div>
          ) : (
            // @ts-ignore - RL is dynamic module
            <RL.MapContainer whenCreated={onMapCreated} style={{ height: "100%", width: "100%" }} center={[39.5, -98.35]} zoom={4} scrollWheelZoom={true}>
              {/* @ts-ignore */}
              <RL.TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" tileSize={256} detectRetina={false} />
              {geojson && (
                // @ts-ignore
                <RL.GeoJSON data={geojson} style={{ color: "#ff5722", weight: 4 }} />
              )}
            </RL.MapContainer>
          )}
        </div>

        {stats && (
          <div style={{ marginTop: 12 }}>
            <div><strong>Distance:</strong> {(stats.distance_m / 1000).toFixed(2)} km</div>
            {stats.elevation && <div><strong>Elevation:</strong> {Math.round(stats.elevation.min)}–{Math.round(stats.elevation.max)} m</div>}
            {stats.bounds && <div><strong>Bounds:</strong> {stats.bounds.join(", ")}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* -----------------------
   Typed helper
   ----------------------- */

function computeTrackStats(fc: FeatureCollection<Geometry>): TrackStats {
  let total = 0;
  const elev: number[] = [];
  let bounds: [number, number, number, number] | null = null;

  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === "LineString") {
      const line: Feature<LineString> = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: g.coordinates as Position[] },
        properties: {},
      };
      total += turf.length(line, { units: "kilometers" }) * 1000;
      for (const p of g.coordinates as Position[]) if (p.length > 2 && typeof p[2] === "number") elev.push(p[2]);
    } else if (g.type === "MultiLineString") {
      const multi: Feature<MultiLineString> = {
        type: "Feature",
        geometry: { type: "MultiLineString", coordinates: g.coordinates as Position[][] },
        properties: {},
      };
      total += turf.length(multi, { units: "kilometers" }) * 1000;
      for (const line of g.coordinates as Position[][]) for (const p of line) if (p.length > 2 && typeof p[2] === "number") elev.push(p[2]);
    }
  }

  try { bounds = turf.bbox(fc) as [number, number, number, number]; } catch { bounds = null; }

  return { distance_m: Math.round(total), bounds, elevation: elev.length ? { min: Math.min(...elev), max: Math.max(...elev) } : null };
}
