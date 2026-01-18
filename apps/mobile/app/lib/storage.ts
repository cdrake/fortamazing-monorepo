// src/lib/storage.ts
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/config/firebase";

/**
 * uploadImageFromUri - upload a local file URI (expo image picker) to Firebase Storage
 * remotePath example: `hikes/{hikeId}/images/{filename}.jpg`
 */
export async function uploadImageFromUri(uri: string, remotePath: string) {
  // fetch/response.blob works fine on Expo
  const response = await fetch(uri);
  const blob = await response.blob();

  const ref = storageRef(storage, remotePath);
  await uploadBytes(ref, blob);
  const url = await getDownloadURL(ref);
  return url;
}
