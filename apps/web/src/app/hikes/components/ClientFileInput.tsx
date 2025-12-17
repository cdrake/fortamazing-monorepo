// ClientFileInput.tsx (patched)
"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  onFiles: (files: FileList | File[]) => void;
  accept?: string;
  className?: string;
  buttonLabel?: string;
};

export default function ClientFileInput({ onFiles, accept = ".gpx,.kml", className, buttonLabel = "Choose files" }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const inp = inputRef.current;
    if (!inp) return;

    // 1) Defensive: force property + attribute
    function ensureMultiple() {
      try {
        if(!inp) return;
        inp.multiple = true;
        // Some browsers/HTML serializers expect the attribute's presence (value may be ""), set both
        inp.setAttribute("multiple", "");
      } catch (err) {
        // ignore
      }
    }

    ensureMultiple();
    inp.accept = accept;

    // 2) Log outerHTML once on mount so you can inspect what the input actually looks like in the DOM
    if (process.env.NODE_ENV !== "production") {
      // small delay to give React a chance to finish any synchronous patches
      setTimeout(() => {
        try {
          // eslint-disable-next-line no-console
          console.log("[ClientFileInput] mounted input.outerHTML:", inp.outerHTML);
        } catch {}
      }, 50);
    }

    // 3) MutationObserver: if anything removes the attribute later, reapply and log (dev only).
    if (typeof MutationObserver !== "undefined") {
      const obs = new MutationObserver(mutations => {
        for (const m of mutations) {
          // if attributes changed and multiple attribute is gone, restore it
          if (m.type === "attributes" && (m.attributeName === "multiple" || m.attributeName === null)) {
            // attribute removed?
            if (!inp.hasAttribute("multiple") || !inp.multiple) {
              try {
                inp.multiple = true;
                inp.setAttribute("multiple", "");
                if (process.env.NODE_ENV !== "production") {
                  // eslint-disable-next-line no-console
                  console.warn("[ClientFileInput] Re-applied missing multiple attribute due to mutation:", m);
                  // Optionally capture a stack trace for better debugging:
                  try {
                    throw new Error("attr-removed-stack");
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.log((e as Error).stack);
                  }
                }
              } catch {}
            }
          }
        }
      });
      obs.observe(inp, { attributes: true, attributeFilter: ["multiple"], childList: false, subtree: false });
      observerRef.current = obs;
    }

    return () => {
      // cleanup
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [accept]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('on change called')
    console.log(files);
    if (!files) return;
    onFiles(files);
    // optionally clear value so same file(s) can be re-picked later
    // e.target.value = "";
  };

  const open = async () => {
    // Prefer native multi-picker on Chromium if available
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
        onFiles(files);
        return;
      }
    } catch (err) {
      // fall through to input click
    }
    inputRef.current?.click();
  };

  return (
    <div className={className}>
      <button type="button" onClick={open}>{buttonLabel}</button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        // keep JSX boolean too — defensive
        multiple={true}
        style={{ display: "none" }}
      />
    </div>
  );
}
