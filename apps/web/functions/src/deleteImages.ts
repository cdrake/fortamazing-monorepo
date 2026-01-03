// functions/src/deleteImage.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Storage } from "@google-cloud/storage";
import { onCall } from "firebase-functions/v2/https";


admin.initializeApp();
const db = admin.firestore();
const storage = new Storage();
const BUCKET_NAME = process.env.BUCKET_NAME || admin.storage().bucket().name;
const bucket = storage.bucket(BUCKET_NAME);

export const deleteImage = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60 },
  async (req) => {
    const data = req.data;
    const auth = req.auth;
  const uid = auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Must be signed in");

  const { photoId } = data;
  if (!photoId) throw new functions.https.HttpsError("invalid-argument", "photoId required");

  const photoRef = db.collection("photos").doc(photoId);
  const docSnap = await photoRef.get();
  if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "photo not found");
  const photo = docSnap.data() as any;

  // check owner or admin
  const isOwner = photo.ownerId === uid;
  const isAdmin = auth?.token?.admin === true || auth?.token?.role === "admin";
  if (!isOwner && !isAdmin) throw new functions.https.HttpsError("permission-denied", "Not allowed");

  // collect paths to delete
  const toDelete: string[] = [];
  if (photo.originalPath) toDelete.push(photo.originalPath);
  // delete variants folder
  const prefix = `variants/${photoId}/`;
  const [files] = await bucket.getFiles({ prefix });
  for (const f of files) toDelete.push(f.name);

  // perform deletes (batch)
  try {
    const deletePromises = toDelete.map(name => bucket.file(name).delete().catch(err => {
      // ignore not found
      if (err.code === 404) return null;
      throw err;
    }));
    await Promise.all(deletePromises);
    // delete firestore doc
    await photoRef.delete();
    return { success: true, deleted: toDelete.length };
  } catch (err) {
    console.error("deleteImage error", err);
    throw new functions.https.HttpsError("internal", "Failed to delete image");
  }
});
