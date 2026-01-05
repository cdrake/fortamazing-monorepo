"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  onFiles: (files: FileList | File[]) => void;
  accept?: string;
  className?: string;
  buttonLabel?: string;
};

export default function ClientFileInput({
  onFiles,
  accept = ".gpx,.kml",
  className,
  buttonLabel = "Choose files",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const inp = inputRef.current;
    if (!inp) return;

    // Defensive: ensure both property and attribute are present
    function ensureMultiple() {
      try {
        if (!inp) return;
        inp.multiple = true;
        inp.setAttribute("multiple", "");
      } catch {
        // ignore
      }
    }

    ensureMultiple();
    inp.accept = accept;

    // Dev: log outerHTML once so we can inspect the DOM
    if (process.env.NODE_ENV !== "production") {
      setTimeout(() => {
        try {
          console.log("[ClientFileInput] mounted input.outerHTML:", inp.outerHTML);
        } catch {
          // ignore
        }
      }, 50);
    }

    // MutationObserver to restore attribute if removed (dev-time debugging)
    if (typeof MutationObserver !== "undefined") {
      const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes" && (m.attributeName === "multiple" || m.attributeName === null)) {
            if (!inp.hasAttribute("multiple") || !inp.multiple) {
              try {
                inp.multiple = true;
                inp.setAttribute("multiple", "");
                if (process.env.NODE_ENV !== "production") {
                  console.warn("[ClientFileInput] Re-applied missing multiple attribute due to mutation:", m);
                  try {
                    throw new Error("attr-removed-stack");
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.log((e as Error).stack);
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        }
      });
      obs.observe(inp, { attributes: true, attributeFilter: ["multiple"], childList: false, subtree: false });
      observerRef.current = obs;
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [accept]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    // eslint-disable-next-line no-console
    console.log("on change called", files);
    if (!files) return;
    onFiles(files);
    // optionally clear value so same files can be re-picked later:
    // e.target.value = "";
  };

  const open = async () => {
    // Try native File System Access API first (if available)
    try {
      const win = window as unknown as { showOpenFilePicker?: unknown };
      const picker = win.showOpenFilePicker;
      if (typeof picker === "function") {
        // The return type is implementation-defined in different browsers/TS versions,
        // so treat as unknown[] and assert minimal shape when calling getFile().
        const handles = (await (picker as (...args: unknown[]) => Promise<unknown[]>).call(win, {
          multiple: true,
          types: [
            {
              description: "GPX / KML",
              accept: {
                "application/gpx+xml": [".gpx"],
                "application/vnd.google-earth.kml+xml": [".kml"],
                "application/octet-stream": [".gpx", ".kml"],
              },
            },
          ],
        })) as unknown[];

        // Convert handles to File[] by calling getFile() on each handle if available
        const files: File[] = await Promise.all(
          handles.map(async (h) => {
            // minimal shape assertion: object with getFile function returning Promise<File>
            if (h && typeof h === "object" && typeof (h as { getFile?: unknown }).getFile === "function") {
              return await (h as { getFile: () => Promise<File> }).getFile();
            }
            // Fallback: throw to cause outer catch -> fallback to input click
            throw new Error("Handle does not support getFile()");
          })
        );

        onFiles(files);
        return;
      }
    } catch {
      // fall through to input click fallback
    }

    inputRef.current?.click();
  };

  return (
    <div className={className}>
      <button type="button" onClick={open}>
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        multiple={true}
        style={{ display: "none" }}
      />
    </div>
  );
}
