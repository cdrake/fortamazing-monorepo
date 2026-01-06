"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import { extractElevationsFromFeature } from "../lib/trackUtils";

export type ImageMarker = {
  lat: number;
  lon: number;
  url: string;
  title?: string;
  previewSize?: number;
};

type DayTrack = {
  id: string;
  name?: string;
  geojson: FeatureCollection<Geometry>;
  color?: string;
  visible?: boolean;
};

type TileLayerSpec = {
  id: string;
  name?: string;
  url: string;
  options?: any;
};

type MapViewProps = {
  dayTracks?: DayTrack[];
  combinedGeojson?: FeatureCollection<Geometry>;
  activeTileId?: string;
  tileLayers?: TileLayerSpec[];
  /** called with the raw Leaflet map instance when ready */
  onMapApiReady?: (map: any) => void;
  style?: React.CSSProperties;
  className?: string;
  /** optional center + zoom fallback when no geometry present */
  center?: [number, number];
  zoom?: number;
  imageMarkers?: ImageMarker[];
  onFeatureClick?: (payload: { elevations: number[]; feature: any; dayTrackId?: string }) => void;
  activeTrackId?: string;
  onTrackClick?: (trackId: string) => void;
};

export default function MapView({
  dayTracks = [],
  combinedGeojson = undefined,
  activeTileId = "osm",
  tileLayers = [{ id: "osm", name: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", options: { maxZoom: 19 } }],
  onMapApiReady,
  style,
  className,
  center = [37.773972, -122.431297],
  zoom = 10,
  imageMarkers = [],
  onFeatureClick,
  activeTrackId,
  onTrackClick,
}: MapViewProps) {
  // react-leaflet module (dynamically imported)
  const [RL, setRL] = useState<any | null>(null);
  const mapRef = useRef<any | null>(null);
  const mountedRef = useRef(true);

  // load react-leaflet + ensure leaflet icon paths are set
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const mod = await import("react-leaflet");
        // sometimes react-leaflet exports the internals and types; store module
        setRL(mod);

        // fix leaflet icon URLs
        try {
          const Lmod = await import("leaflet");
          const L: any = (Lmod as any).default ?? Lmod;

          // attempt to resolve images from node_modules or fallback
          let markerUrl: string | undefined;
          let marker2x: string | undefined;
          let shadowUrl: string | undefined;

          try {
            const m1 = await import("leaflet/dist/images/marker-icon.png");
            const m2 = await import("leaflet/dist/images/marker-icon-2x.png");
            const sh = await import("leaflet/dist/images/marker-shadow.png");
            markerUrl = (m1 && (m1 as any).default) || (m1 as any).src || undefined;
            marker2x = (m2 && (m2 as any).default) || (m2 as any).src || undefined;
            shadowUrl = (sh && (sh as any).default) || (sh as any).src || undefined;
          } catch (e) {
            markerUrl = markerUrl ?? "/leaflet/marker-icon.png";
            marker2x = marker2x ?? "/leaflet/marker-icon-2x.png";
            shadowUrl = shadowUrl ?? "/leaflet/marker-shadow.png";
          }

          if (markerUrl || marker2x || shadowUrl) {
            try {
              L.Icon.Default.mergeOptions({
                iconUrl: markerUrl,
                iconRetinaUrl: marker2x,
                shadowUrl,
              });
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          // ignore leaflet icon fix errors
        }
      } catch (e) {
        console.warn("react-leaflet failed to load dynamically:", e);
      }
    })();

    return () => { mountedRef.current = false; };
  }, []);

  // callback when map is created
  const handleWhenCreated = useCallback((mapInstance: any) => {
    mapRef.current = mapInstance;
    try { if (typeof onMapApiReady === "function") onMapApiReady(mapInstance); } catch {}
    // fit to geometry if present
    try {
      if (combinedGeojson && combinedGeojson.features && combinedGeojson.features.length && mapInstance) {
        try {
          const L = (window as any).L;
          if (L && typeof L.geoJSON === "function") {
            const g = L.geoJSON(combinedGeojson);
            mapInstance.fitBounds(g.getBounds(), { padding: [20, 20], maxZoom: 15 });
            setTimeout(() => { try { mapInstance.invalidateSize(); } catch {} }, 120);
          }
        } catch (e) {
          // ignore
        }
      } else {
        setTimeout(() => { try { mapInstance.invalidateSize(); } catch {} }, 120);
      }
    } catch (e) {}
  }, [combinedGeojson, onMapApiReady]);

  // helper that renders the map content (once RL available)
  const renderMap = () => {
    if (!RL) return null;

    const { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, Popup, useMap } = RL as any;

    // MapSetter: calls onReady with the map instance when available (uses useMap hook)
    const MapSetter = () => {
      const map = useMap();
      useEffect(() => {
        if (map) {
          handleWhenCreated(map);
        }
         
      }, [map]);
      return null;
    };

    // style helpers
    const combinedStyle = (feat: any) => ({ color: "#ff5722", weight: 4, opacity: 0.25 });
    const dayStyle = (d: DayTrack) => () => ({ color: d.color ?? "#3388ff", weight: 4, opacity: 1.0 });

    const chosenTile = tileLayers.find(t => t.id === activeTileId) ?? tileLayers[0];
    const makeOnEachFeature =
    (dayTrackId?: string) =>
    (feature: any, layer: any) => {
        if (!feature || !layer) return;

        // debug id for feature (if available)
        const featId = feature?.id ?? feature?.properties?.id ?? `${dayTrackId ?? "combined"}-${Math.random().toString(36).slice(2,8)}`;

        // attach click handler
        layer.on("click", (ev: any) => {
        try {
            const elevations = extractElevationsFromFeature(feature) || [];
            // debug - log so you can see calls
             
            console.debug("[MapView] feature clicked", { featId, dayTrackId, elevationsLength: elevations.length });

            if (typeof onFeatureClick === "function") {
            onFeatureClick({ elevations, feature, dayTrackId });
            }
        } catch (e) {
             
            console.warn("[MapView] onEachFeature click handler error", e);
        }
        });

        // accessibility and UX
        try {
        const el = layer.getElement?.();
        if (el) el.style.cursor = "pointer";
        } catch {}
    };


    return (
      // @ts-ignore - MapContainer props typed in react-leaflet; we intentionally keep any here
      <MapContainer
        whenCreated={(map: any) => handleWhenCreated(map)}
        style={{ height: "100%", width: "100%" }}
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
      >
        <MapSetter />
        <TileLayer url={chosenTile.url} {...(chosenTile.options || {})} />
        {combinedGeojson && (
          // @ts-ignore
          <GeoJSON data={combinedGeojson} style={combinedStyle} onEachFeature={makeOnEachFeature()}/>
        )}

        {dayTracks.map((d) => d.visible !== false && d.geojson && (
        // @ts-ignore
        <GeoJSON
            key={d.id}
            data={d.geojson}
            // dynamic style — heavier if active
            style={() => {
            const isActive = d.id === activeTrackId;
            return {
                color: d.color ?? "#3388ff",
                weight: isActive ? 7 : 4,
                opacity: isActive ? 1.0 : 0.85,
                dashArray: isActive ? undefined : "0",
                lineJoin: "round",
                lineCap: "round",
            };
            }}
            // onEachFeature to attach click handler and bring-to-front behavior
            onEachFeature={(feature: any, layer: any) => {
            try {
                layer.on("click", (ev: any) => {
                // call parent's callback (if provided)
                try { onTrackClick?.(d.id); } catch {}
                // emphasize the clicked layer immediately (visual feedback)
                try {
                    layer.setStyle({ weight: 8, opacity: 1.0 });
                    if (typeof layer.bringToFront === "function") layer.bringToFront();
                } catch (e) { /* ignore */ }
                });
                // optional hover pointer
                layer.on("mouseover", () => {
                try { layer.setStyle({ weight: Math.min((layer.options?.weight ?? 4) + 2, 10) }); } catch {}
                });
                layer.on("mouseout", () => {
                // restore style (let parent re-render decide final)
                try { /* nothing, parent style will apply on re-render */ } catch {}
                });
            } catch (e) { /* ignore per-layer attach errors */ }
            }}
            // ensure points are rendered as circle markers (if any)
            // @ts-ignore
            pointToLayer={(_feature: any, latlng: any) => (window as any).L ? (window as any).L.circleMarker(latlng, { radius: 5, fill: true, fillOpacity: 0.9, color: d.color ?? "#3388ff", weight: 1 }) : null}
        />
        ))}

        {/* imageMarkers: render simple Marker + Popup with thumbnail */}
        {Array.isArray(imageMarkers) && imageMarkers.map((m, i) => {
          // ensure lat/lon are numbers
          const lat = Number(m.lat);
          const lon = Number(m.lon);
          if (!isFinite(lat) || !isFinite(lon)) return null;
          const previewSize = m.previewSize ?? 160;
          return (
            // @ts-ignore
            <Marker key={`img-${i}-${lat}-${lon}`} position={[lat, lon]} title={m.title ?? `Photo ${i + 1}`}>
              {/* @ts-ignore */}
              <Popup>
                <div style={{ maxWidth: previewSize }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{m.title ?? `Photo ${i + 1}`}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.title ?? `photo-${i + 1}`} style={{ width: "100%", height: "auto", borderRadius: 6 }} />
                  <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                    <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Open</a>
                    <a href={m.url} download style={{ fontSize: 12 }}>Download</a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

      </MapContainer>
    );
  };

  return (
    <div className={className ?? ""} style={{ position: "relative", width: "100%", height: 400, ...(style || {}) }}>
      {!RL ? (
        <div style={{ padding: 16 }}>Loading map…</div>
      ) : (
        renderMap()
      )}
    </div>
  );
}
