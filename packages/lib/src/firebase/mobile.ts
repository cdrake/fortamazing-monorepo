import Constants from "expo-constants";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import type { FirebaseClientConfig } from "./config";

export function getFirebaseMobile() {
  const cfg = (Constants.expoConfig?.extra as any)?.firebase as FirebaseClientConfig;

  if (!cfg?.apiKey || !cfg?.projectId || !cfg?.appId) {
    throw new Error("Missing Firebase config for mobile");
  }

  const app = getApps().length ? getApp() : initializeApp(cfg);
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
}
