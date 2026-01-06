// app/lib/firebase.ts
import { Platform } from "react-native";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const storage = getStorage(app);

// ---------- Auth init (robust runtime resolution) ----------
let auth: any = null;

if (Platform.OS === "web") {
  // On web, use normal getAuth
  // import lazily to avoid bundling RN bits into web build
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getAuth } = require("firebase/auth");
  auth = getAuth(app);
} else {
  // Native platforms: try several strategies at runtime
  try {
    // 1) Prefer initializeAuth from firebase/auth
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const authModule = require("firebase/auth");

    const initializeAuth = authModule.initializeAuth ?? authModule.default?.initializeAuth;
    // try a few persistence helpers that different SDKs expose
    const getReactNativePersistence = authModule.getReactNativePersistence;
    const reactNativeLocalPersistence = authModule.reactNativeLocalPersistence;
    const getReactNativePersistenceFactory =
      authModule.getReactNativePersistence ?? authModule.reactNativeLocalPersistence;

    if (typeof initializeAuth === "function") {
      // If a factory exists that expects AsyncStorage, call it
      if (typeof getReactNativePersistence === "function") {
        try {
          auth = initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage),
          });
        } catch (e) {
          // some builds expose reactNativeLocalPersistence (no factory arg)
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            auth = initializeAuth(app, { persistence: reactNativeLocalPersistence });
          } catch (e2) {
            // final fallback: try passing the factory directly (some versions)
            try {
              auth = initializeAuth(app, {
                // @ts-ignore runtime
                persistence: getReactNativePersistenceFactory,
              });
            } catch (e3) {
              // fall through to getAuth below
              console.warn("initializeAuth with RN persistence failed", e3);
            }
          }
        }
      } else if (typeof reactNativeLocalPersistence !== "undefined") {
        try {
          auth = initializeAuth(app, { persistence: reactNativeLocalPersistence });
        } catch (e) {
          console.warn("initializeAuth with reactNativeLocalPersistence failed", e);
        }
      } else {
        // no persistence helper exports found on authModule
        // attempt to initializeAuth without custom persistence (may default to memory)
        try {
          auth = initializeAuth(app);
        } catch (e) {
          console.warn("initializeAuth default failed", e);
        }
      }
    }
  } catch (e) {
    console.warn("Runtime require('firebase/auth') failed:", e);
  }

  // If previous attempts didn't set auth, fall back to getAuth (no persistence)
  if (!auth) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getAuth } = require("firebase/auth");
      auth = getAuth(app);
    } catch (e) {
      console.error("Unable to initialize Firebase Auth:", e);
      throw e;
    }
  }
}

export { auth, app };
export default app;
