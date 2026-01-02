"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type LightboxGalleryProps = {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  downloadLabel?: string;
  openLabel?: string;
};

export default function LightboxGallery({
  images,
  initialIndex = 0,
  onClose,
  downloadLabel = "Download",
  openLabel = "Open",
}: LightboxGalleryProps) {
  const [index, setIndex] = useState<number>(
    Math.max(0, Math.min(initialIndex, (images.length - 1) || 0))
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const startTouch = useRef<{ x: number; y: number } | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Keyboard handlers
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose]);

  useEffect(() => {
    setIsLoaded(false);
    setError(false);
  }, [index]);

  function prev() {
    setIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));
  }
  function next() {
    setIndex((i) => (images.length ? (i + 1) % images.length : 0));
  }

  function onTouchStart(e: React.TouchEvent) {
    if (!e.touches || e.touches.length === 0) return;
    startTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchMove(e: React.TouchEvent) {
    // prevent page scroll while swiping lightbox
    e.preventDefault();
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!startTouch.current) return;
    const end = e.changedTouches && e.changedTouches[0];
    if (!end) { startTouch.current = null; return; }
    const dx = end.clientX - startTouch.current.x;
    const dy = end.clientY - startTouch.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx > 0) prev(); else next();
    }
    startTouch.current = null;
  }

  if (!images || images.length === 0) return null;

  const content = (
    <>
      {/* Fixed floating close button — always top-right of viewport */}
      <div
        style={{
          position: "fixed",
          top: 18,
          right: 18,
          zIndex: 14000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          aria-label="Close gallery"
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.98)",
            color: "#111",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            borderRadius: 8,
            padding: "8px 10px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
            minWidth: 44,
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>

      <div
        // backdrop: clicks on this container (currentTarget) will close the gallery
        onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 13900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.85)",
          WebkitOverflowScrolling: "touch",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: "980px",
            height: "88vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            outline: "none",
          }}
        >
          {/* Prev */}
          <button
            aria-label="Previous"
            onClick={(ev) => { ev.stopPropagation(); prev(); }}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 14100,
              background: "rgba(0,0,0,0.32)",
              color: "white",
              border: "none",
              padding: 10,
              borderRadius: 999,
            }}
          >
            ◀
          </button>

          {/* Next */}
          <button
            aria-label="Next"
            onClick={(ev) => { ev.stopPropagation(); next(); }}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 14100,
              background: "rgba(0,0,0,0.32)",
              color: "white",
              border: "none",
              padding: 10,
              borderRadius: 999,
            }}
          >
            ▶
          </button>

          {/* Actions / Counter */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 14100,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div style={{ background: "rgba(0,0,0,0.32)", padding: "6px 8px", borderRadius: 6, color: "white", fontSize: 13 }}>
              {index + 1} / {images.length}
            </div>
            <a
              href={images[index]}
              target="_blank"
              rel="noreferrer"
              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 13 }}
            >
              {openLabel}
            </a>
            <a
              href={images[index]}
              download
              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 13 }}
            >
              {downloadLabel}
            </a>
          </div>

          {/* Image area */}
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!isLoaded && !error && <div style={{ color: "rgba(255,255,255,0.75)" }}>Loading…</div>}
            {error && <div style={{ color: "rgba(255,255,255,0.75)" }}>Failed to load image</div>}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={images[index]}
              src={images[index]}
              alt={`image-${index + 1}`}
              onLoad={() => { if (mountedRef.current) setIsLoaded(true); }}
              onError={() => { if (mountedRef.current) setError(true); }}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", userSelect: "none", pointerEvents: "auto" }}
            />
          </div>
        </div>
      </div>
    </>
  );

  // Render via portal to document.body so this lightbox is isolated from parent containers/modals.
  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  // SSR fallback
  return null;
}
