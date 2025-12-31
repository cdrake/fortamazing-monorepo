// src/app/hikes/components/PhotoMarkersFromImages.tsx
"use client";
import React, { useEffect, useRef } from "react";
import L, { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { extractExifFromUrlWithFallback } from "../lib/imageHelpers"; // new function you added
import { getFirestore, doc, setDoc } from "firebase/firestore";

// PhotoItem should match your Firestore shape
export type PhotoItem = {
  id: string;
  downloadUrl?: string | null;
  thumbnailUrl?: string | null;
  originalName?: string | null;
  lat?: number | null;
  lon?: number | null;
  [k: string]: any;
};

type Props = {
  map: LeafletMap | null;
  photos: PhotoItem[];
  // Optional: URL of server-side proxy cloud function that returns { lat, lon }
  serverProxyUrl?: string | null;
  saveCoordsToFirestore?: boolean; // default true
  firestoreCollection?: string;    // default "photos"
};

export default function PhotoMarkersFromImages({
  map,
  photos,
  serverProxyUrl = null,
  saveCoordsToFirestore = true,
  firestoreCollection = "photos",
}: Props) {
  const layerRef = useRef<LayerGroup | null>(null);
  const db = getFirestore();

  useEffect(() => {
    if (!map) return;
    // teardown previous
    if (layerRef.current) {
      try { layerRef.current.clearLayers(); map.removeLayer(layerRef.current); } catch {}
      layerRef.current = null;
    }

    const group = L.layerGroup();
    layerRef.current = group;
    const bounds: [number, number][] = [];

    // process sequentially to avoid many simultaneous fetches
    (async () => {
      for (const p of photos) {
        try {
          // prefer cached coords in the doc
          let lat: number | null = typeof p.lat === "number" ? p.lat : null;
          let lon: number | null = typeof p.lon === "number" ? p.lon : null;

          // if missing coords, try extracting from image bytes (client) with server fallback
          if ((lat == null || lon == null) && p.downloadUrl) {
            const gps = await extractExifFromUrlWithFallback(p.downloadUrl, {
              serverProxyUrl: serverProxyUrl ?? undefined,
              serverProxyMethod: serverProxyUrl ? "GET" : undefined,
            });
            if (gps) {
              lat = gps.lat;
              lon = gps.lon;
              // persist back to Firestore for caching if requested and we have an id
              if (saveCoordsToFirestore && p.id) {
                try {
                  const docRef = doc(db, firestoreCollection, p.id);
                  // merge so we don't clobber other fields
                  await setDoc(docRef, { lat, lon }, { merge: true });
                } catch (e) {
                  console.warn("Failed to save coords to Firestore:", e);
                }
              }
            }
          }

          if (typeof lat === "number" && typeof lon === "number") {
            const latlng: [number, number] = [lat, lon];
            bounds.push(latlng);

            const iconHtml = p.thumbnailUrl
              ? `<img src="${p.thumbnailUrl}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.25)" />`
              : `<div style="width:24px;height:24px;background:#1976d2;border-radius:50%"></div>`;

            const icon = L.divIcon({
              html: iconHtml,
              className: "photo-divicon",
              iconSize: p.thumbnailUrl ? [56, 56] : [24, 24],
              iconAnchor: p.thumbnailUrl ? [28, 28] : [12, 12],
              popupAnchor: [0, -18],
            });

            const marker = L.marker(latlng, { icon, title: p.originalName ?? "Photo" });
            const popupHtml = `
              <div style="min-width:180px;max-width:320px">
                ${p.thumbnailUrl ? `<div style="height:120px;overflow:hidden;border-radius:6px"><img src="${p.thumbnailUrl}" style="width:100%;height:100%;object-fit:cover" /></div>` : ""}
                <div style="padding-top:8px;font-size:13px"><strong>${escapeHtml(p.originalName ?? "Photo")}</strong></div>
                ${p.downloadUrl ? `<div style="margin-top:8px"><a href="${p.downloadUrl}" target="_blank" rel="noopener noreferrer">Open image</a></div>` : ""}
              </div>
            `;
            marker.bindPopup(popupHtml, { maxWidth: 320 });
            marker.addTo(group);
          }
        } catch (e) {
          console.warn("PhotoMarkersFromImages processing error:", e);
        }
      }

      group.addTo(map);
      if (bounds.length > 0) {
        try {
          map.fitBounds(L.latLngBounds(bounds as any).pad(0.12), { maxZoom: 16 });
        } catch {}
      }
    })();

    return () => {
      try { group.clearLayers(); map.removeLayer(group); } catch {}
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(photos), serverProxyUrl, saveCoordsToFirestore, firestoreCollection]);

  return null;
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
