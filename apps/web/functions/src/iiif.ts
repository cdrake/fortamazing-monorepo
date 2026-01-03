// functions/src/iiif.ts
import * as functions from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";
import sharp from "sharp";
import path from "path";
import os from "os";
import fs from "fs/promises";

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket(); // uses default bucket from admin SDK

const app = express();
app.disable("x-powered-by");

// ----------------------
// Helpers
// ----------------------
async function verifyAuthToken(req: express.Request) {
  const auth = (req.header("Authorization") || req.header("authorization")) as string | undefined;
  if (!auth?.startsWith("Bearer ")) return null;
  const idToken = auth.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    console.warn("Invalid token:", err);
    return null;
  }
}

function normalizeFormat(q: string) {
  const m = q.match(/\.(jpg|jpeg|png|webp|avif)$/i);
  return m ? m[1].toLowerCase().replace("jpg", "jpeg") : "jpeg";
}

function variantPathFor(id: string, region: string, size: string, rotation: string, qualityWithExt: string) {
  const safe = encodeURIComponent(`${region}_${size}_${rotation}_${qualityWithExt}`);
  return `variants/${id}/${safe}`;
}

function parseRegion(region: string, metaWidth?: number, metaHeight?: number) {
  if (region === "full") return null;
  if (region.startsWith("pct:")) {
    if (!metaWidth || !metaHeight) return null;
    const [px, py, pw, ph] = region.slice(4).split(",").map(Number);
    const left = Math.round((px / 100) * metaWidth);
    const top = Math.round((py / 100) * metaHeight);
    const width = Math.round((pw / 100) * metaWidth);
    const height = Math.round((ph / 100) * metaHeight);
    return { left, top, width, height };
  } else {
    const [x, y, w, h] = region.split(",").map(Number);
    return { left: x, top: y, width: w, height: h };
  }
}

function parseSize(size: string, origW: number, origH: number) {
  if (size === "full") return { width: origW, height: origH, options: {} };
  if (size.startsWith("pct:")) {
    const pct = Number(size.slice(4));
    return { width: Math.round((pct / 100) * origW), height: Math.round((pct / 100) * origH), options: {} };
  }
  if (size.startsWith("!")) {
    const [w, h] = size.slice(1).split(",").map(s => s ? Number(s) : null);
    return { width: w ?? null, height: h ?? null, options: { fit: sharp.fit.inside } };
  }
  if (size.endsWith(",")) {
    const w = Number(size.slice(0, -1));
    return { width: w, height: null, options: { fit: sharp.fit.inside } };
  }
  if (size.startsWith(",")) {
    const h = Number(size.slice(1));
    return { width: null, height: h, options: { fit: sharp.fit.inside } };
  }
  const [w, h] = size.split(",").map(s => s ? Number(s) : null);
  return { width: w, height: h, options: { fit: sharp.fit.fill } };
}

// ----------------------
// info.json route (IIIF)
// ----------------------
app.get("/iiif/:id/info.json", async (req, res) => {
  const { id } = req.params;
  try {
    const photoSnap = await db.collection("photos").doc(id).get();
    if (!photoSnap.exists) return res.status(404).send("Not found");
    const photo = photoSnap.data() as any;

    // If width/height are missing, attempt to read metadata from Storage (best-effort)
    if (!photo.width || !photo.height) {
      try {
        if (photo.originalPath) {
          const oFile = bucket.file(photo.originalPath);
          const [exists] = await oFile.exists();
          if (exists) {
            // download head and use sharp metadata
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "iiif-meta-"));
            const tmpPath = path.join(tmpDir, "meta");
            await oFile.download({ destination: tmpPath });
            const m = await sharp(tmpPath).metadata();
            photo.width = m.width ?? photo.width;
            photo.height = m.height ?? photo.height;
            await fs.rm(tmpDir, { recursive: true, force: true });
            // update doc for future
            await db.collection("photos").doc(id).update({ width: photo.width, height: photo.height });
          }
        }
      } catch (e) {
        console.warn("Could not read original metadata:", e);
      }
    }

    const tileSize = photo.tileSize || 512;
    const formats = ["jpg", "png", "webp"];
    const info: any = {
      "@context": "http://iiif.io/api/image/2/context.json",
      "@id": `${req.protocol}://${req.get("host")}/iiif/${encodeURIComponent(id)}`,
      "protocol": "http://iiif.io/api/image",
      "width": photo.width || 0,
      "height": photo.height || 0,
      "tiles": [{ width: tileSize, scaleFactors: [1, 2, 4, 8, 16] }],
      "profile": ["http://iiif.io/api/image/2/level2.json"],
      "sizes": photo.sizes || undefined,
      "formats": formats
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.json(info);
  } catch (err) {
    console.error("info.json error", err);
    return res.status(500).send("Server error");
  }
});

// ----------------------
// IIIF-style tile/variant route
// /iiif/:id/:region/:size/:rotation/:quality
// ----------------------
app.get("/iiif/:id/:region/:size/:rotation/:quality", async (req, res) => {
  const { id, region, size, rotation } = req.params;
  const qualityWithExt = req.params.quality;
  const fmt = normalizeFormat(qualityWithExt);

  try {
    // optional auth verification
    const token = await verifyAuthToken(req);

    // fetch photo doc
    const photoRef = db.collection("photos").doc(id);
    const photoSnap = await photoRef.get();
    if (!photoSnap.exists) return res.status(404).send("Image not found");
    const photo = photoSnap.data() as any;

    // authorization: only owner/admin when not approved
    if (photo.approved === false) {
      if (!token) return res.status(403).send("Not available");
      const isOwner = token.uid === photo.ownerId;
      const isAdmin = token.admin === true || token.role === "admin";
      if (!isOwner && !isAdmin) return res.status(403).send("Not permitted");
    }

    const vPath = variantPathFor(id, region, size, rotation, qualityWithExt);
    const vFile = bucket.file(vPath);

    // If variant exists, stream it
    const [exists] = await vFile.exists();
    if (exists) {
      const [meta] = await vFile.getMetadata();
      res.setHeader("Content-Type", meta.contentType || `image/${fmt}`);
      res.setHeader("Cache-Control", meta.cacheControl || "public, max-age=31536000, immutable");
      return vFile.createReadStream().pipe(res);
    }

    // Variant missing -> generate it
    const originalPath = photo.originalPath as string | undefined;
    if (!originalPath) return res.status(400).send("No original available");

    const oFile = bucket.file(originalPath);
    const [oExists] = await oFile.exists();
    if (!oExists) return res.status(404).send("Original missing");

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "iiif-"));
    const origTmp = path.join(tmpDir, "orig");
    await oFile.download({ destination: origTmp });

    // build sharp pipeline
    let image = sharp(origTmp, { failOnError: false });
    const meta = await image.metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;

    // parse and apply region crop
    const crop = parseRegion(region, origW, origH);
    if (crop) {
      const left = Math.max(0, Math.min(crop.left, origW - 1));
      const top = Math.max(0, Math.min(crop.top, origH - 1));
      const width = Math.max(1, Math.min(crop.width, origW - left));
      const height = Math.max(1, Math.min(crop.height, origH - top));
      image = image.extract({ left, top, width, height });
    }

    // parse size and resize
    const sizeSpec = parseSize(size, origW, origH);
    if (sizeSpec.width || sizeSpec.height) {
      image = image.resize(sizeSpec.width ?? null, sizeSpec.height ?? null, sizeSpec.options ?? {});
    }

    // rotation
    const rot = Number(rotation || 0);
    if (!isNaN(rot) && rot !== 0) image = image.rotate(rot);

    // set output format
    let contentType = `image/${fmt === "jpeg" ? "jpeg" : fmt}`;
    if (fmt === "webp") image = image.webp();
    else if (fmt === "avif") image = image.avif();
    else if (fmt === "png") image = image.png();
    else image = image.jpeg({ quality: 85 });

    const outBuffer = await image.toBuffer();

    // Save the generated variant back to storage
    await vFile.save(outBuffer, {
      metadata: {
        contentType,
        metadata: { generatedBy: "iiif-fn", source: originalPath }
      }
    });

    // Set cache-control so CDN will cache it
    await vFile.setMetadata({ cacheControl: "public, max-age=31536000, immutable" });

    // Cleanup tmp
    await fs.rm(tmpDir, { recursive: true, force: true });

    // Stream the buffer as response
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(outBuffer);
  } catch (err) {
    console.error("IIIF tile error", err);
    return res.status(500).send("Server error");
  }
});

// Export as a v2 HTTP function
export const iiif = onRequest(
  { region: "us-central1", memory: "1GiB", timeoutSeconds: 60 },
  app
);
