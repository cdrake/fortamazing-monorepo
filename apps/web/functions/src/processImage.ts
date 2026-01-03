// functions/src/processImage.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import path from "path";
import os from "os";
import fs from "fs/promises";
import crypto from "crypto";
import { onRequest } from "firebase-functions/v2/https";
import { onObjectFinalized } from "firebase-functions/storage";


admin.initializeApp();
const db = admin.firestore();
const storage = new Storage();
const BUCKET_NAME = process.env.BUCKET_NAME || admin.storage().bucket().name;
const bucket = storage.bucket(BUCKET_NAME);

// helper: create deterministic id from original path or use metadata.customTime?
function idFromPath(pathStr: string) {
  // you probably store photos doc with originalPath; try to find photo doc by originalPath
  return null;
}

export const processImage = onObjectFinalized(
  { region: "us-central1", memory: "2GiB", timeoutSeconds: 120 },
  async (event) => {
    const object = event.data;
    if (!object) return;
  const objectPath = object.name || "";
  if (!objectPath) return null;

  // ignore if this is already a variant
  if (objectPath.startsWith("variants/")) {
    console.log("Variant uploaded, skipping processing:", objectPath);
    return null;
  }

  console.log("Processing uploaded original:", objectPath);

  // Try to find photo doc that references this originalPath
  const photosRef = db.collection("photos");
  const q = photosRef.where("originalPath", "==", objectPath).limit(1);
  const snap = await q.get();
  if (snap.empty) {
    console.warn("No photo doc found for original path", objectPath);
    return null;
  }
  const photoDoc = snap.docs[0];
  const photoId = photoDoc.id;
  const photo = photoDoc.data();

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "proc-"));
  const origTmp = path.join(tmpDir, "orig");
  const origFile = bucket.file(objectPath);
  await origFile.download({ destination: origTmp });

  try {
    const image = sharp(origTmp, { failOnError: false });

    // read metadata
    const meta = await image.metadata();
    const origW = meta.width || 0;
    const origH = meta.height || 0;

    // create pyramidal TIFF (pyramid + tiling)
    // sharp supports pyramid+tile options
    const pyramidPath = `variants/${photoId}/pyramid.tif`;
    const pyramidTmp = path.join(tmpDir, "pyramid.tif");
    await image
      .tiff({ tile: true, pyramid: true, compression: "jpeg", quality: 80 })
      .toFile(pyramidTmp);
    // upload pyramid
    const pyramidFile = bucket.file(pyramidPath);
    await pyramidFile.save(await fs.readFile(pyramidTmp), {
      metadata: { contentType: "image/tiff", metadata: { generatedBy: "processImage" } },
    });
    await pyramidFile.setMetadata({ cacheControl: "public, max-age=31536000, immutable" });

    // create thumb (square center crop 300x300)
    const thumbBuf = await image.clone().resize(300, 300, { fit: sharp.fit.cover, position: sharp.strategy.entropy }).jpeg({ quality: 80 }).toBuffer();
    const thumbPath = `variants/${photoId}/thumb.jpg`;
    await bucket.file(thumbPath).save(thumbBuf, { metadata: { contentType: "image/jpeg" } });
    await bucket.file(thumbPath).setMetadata({ cacheControl: "public, max-age=31536000, immutable" });

    // create medium (max 1600)
    const mediumBuf = await image.clone().resize({ width: 1600, height: 1600, fit: sharp.fit.inside }).jpeg({ quality: 85 }).toBuffer();
    const mediumPath = `variants/${photoId}/medium.jpg`;
    await bucket.file(mediumPath).save(mediumBuf, { metadata: { contentType: "image/jpeg" } });
    await bucket.file(mediumPath).setMetadata({ cacheControl: "public, max-age=31536000, immutable" });

    // create webp (medium)
    const webpBuf = await image.clone().resize({ width: 1600, fit: sharp.fit.inside }).webp({ quality: 80 }).toBuffer();
    const webpPath = `variants/${photoId}/medium.webp`;
    await bucket.file(webpPath).save(webpBuf, { metadata: { contentType: "image/webp" } });
    await bucket.file(webpPath).setMetadata({ cacheControl: "public, max-age=31536000, immutable" });

    // update Firestore photo doc with variants info
    const variants = {
      pyramid: { path: pyramidPath },
      thumb: { path: thumbPath },
      medium: { path: mediumPath },
      webp: { path: webpPath },
    };

    await photoDoc.ref.update({
      variants,
      width: origW,
      height: origH,
      tileSize: 512, // match your IIIF tilesize preference
      status: "done",
      updated_at: Date.now(),
    });

    console.log("Processing done for", photoId);
  } catch (err) {
    console.error("Processing error:", err);
    await photoDoc.ref.update({ status: "error", error: String(err), updated_at: Date.now() });
    throw err;
  } finally {
    // cleanup tmp
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }

  return null;
});
