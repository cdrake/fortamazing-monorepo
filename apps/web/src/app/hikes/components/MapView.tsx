"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import type { FeatureCollection, Geometry } from "geojson";

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
            // bundlers sometimes expose as default export string
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const m1 = await import("leaflet/dist/images/marker-icon.png");
            const m2 = await import("leaflet/dist/images/marker-icon-2x.png");
            const sh = await import("leaflet/dist/images/marker-shadow.png");
            markerUrl = (m1 && (m1 as any).default) || (m1 as any).src || undefined;
            marker2x = (m2 && (m2 as any).default) || (m2 as any).src || undefined;
            shadowUrl = (sh && (sh as any).default) || (sh as any).src || undefined;
          } catch (e) {
            // fallback to common paths (your app should serve these)
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
          // console.warn("leaflet icon fix failed", e);
        }
      } catch (e) {
        // module load failed; RL stays null and we show placeholder
        console.warn("react-leaflet failed to load dynamically:", e);
      }
    })();

    return () => { mountedRef.current = false; };
  }, []);

  // callback when map is created
  const handleWhenCreated = useCallback((mapInstance: any) => {
    mapRef.current = mapInstance;
    // expose to parent
    try { if (typeof onMapApiReady === "function") onMapApiReady(mapInstance); } catch {}
    // fit to geometry if present
    try {
      if (combinedGeojson && combinedGeojson.features && combinedGeojson.features.length && mapInstance) {
        // compute bounds using Leaflet if available
        try {
          const L = (window as any).L;
          if (L && typeof L.geoJSON === "function") {
            const g = L.geoJSON(combinedGeojson);
            mapInstance.fitBounds(g.getBounds(), { padding: [20, 20], maxZoom: 15 });
            // invalidate size after short delay to handle hidden containers
            setTimeout(() => { try { mapInstance.invalidateSize(); } catch {} }, 120);
          }
        } catch (e) {
          // ignore
        }
      } else {
        // if no geometry, ensure size is correct
        setTimeout(() => { try { mapInstance.invalidateSize(); } catch {} }, 120);
      }
    } catch (e) {}
  }, [combinedGeojson, onMapApiReady]);

  // helper that renders the map content (once RL available)
  const renderMap = () => {
    if (!RL) return null;

    const { MapContainer, TileLayer, GeoJSON, CircleMarker, useMap } = RL as any;

    // MapSetter: calls onReady with the map instance when available (uses useMap hook)
    const MapSetter = () => {
      const map = useMap();
      useEffect(() => {
        if (map) {
          handleWhenCreated(map);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [map]);
      return null;
    };

    // pointToLayer wrapper for markers (use circle markers for points)
    const pointToLayer = (feature: any, latlng: any) => {
      const props: any = feature?.properties ?? {};
      const radius = props && typeof props.radius === "number" ? props.radius : 5;
      return CircleMarker(latlng, { radius, fill: true, fillOpacity: 0.9, weight: 1, opacity: 0.95, color: props.color || "#3388ff" });
    };

    // style functions
    const combinedStyle = (feat: any) => ({ color: "#ff5722", weight: 4, opacity: 0.25 });
    const dayStyle = (d: DayTrack) => () => ({ color: d.color ?? "#3388ff", weight: 4, opacity: 1.0 });

    const chosenTile = tileLayers.find(t => t.id === activeTileId) ?? tileLayers[0];

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
          <GeoJSON data={combinedGeojson} style={combinedStyle} />
        )}

        {dayTracks.map((d) => d.visible !== false && d.geojson && (
          // @ts-ignore
          <GeoJSON
            key={d.id}
            data={d.geojson}
            style={dayStyle(d)}
            // @ts-ignore
            pointToLayer={(_feature: any, latlng: any) => (window as any).L ? (window as any).L.circleMarker(latlng, { radius: 5, fill: true, fillOpacity: 0.9, color: d.color ?? "#3388ff", weight: 1 }) : null}
          />
        ))}
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
