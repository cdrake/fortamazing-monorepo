// socialAuth.ts
import { Platform, Linking } from "react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import {
  signInWithCredential,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "firebase/auth";
import { auth } from "@/config/firebase"; // ensure this is the single, shared firebase init

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID_WEB =
  "304795134519-9utqinr8p30spdobnmgckciqn7j7hlei.apps.googleusercontent.com";
const FACEBOOK_APP_ID = "623508453394571";

/**
 * Safely read the app scheme from Expo config
 */
function readAppScheme(): string {
  try {
    const expoConfig: any =
      (Constants as any).expoConfig ?? (Constants as any).manifest ?? {};
    if (typeof expoConfig.scheme === "string") return expoConfig.scheme;
  } catch {}
  return "fortamazingexpoapp";
}

/**
 * Build redirect URI for web & native
 */
function buildRedirectUri(): string {
  if (Platform.OS === "web") {
    return `${
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    }/`;
  }
  return `${readAppScheme()}://redirect`;
}

/**
 * Open auth URL and wait for redirect back into app
 */
async function startAuthFlow(
  authUrl: string,
  returnUrl: string,
  timeoutMs = 60000
) {
  const asAny = AuthSession as any;

  // Prefer AuthSession if available
  if (typeof asAny.startAsync === "function") {
    console.log("[SocialAuth] using AuthSession.startAsync");
    return await asAny.startAsync({ authUrl, returnUrl });
  }

  if (typeof asAny.openAuthSessionAsync === "function") {
    console.log("[SocialAuth] using AuthSession.openAuthSessionAsync");
    return await asAny.openAuthSessionAsync(authUrl, returnUrl);
  }

  // 🔁 Fallback for TestFlight / prod builds
  console.log(
    "[SocialAuth] AuthSession unavailable — using WebBrowser + Linking fallback"
  );

  return new Promise(async (resolve) => {
    let finished = false;

    const onUrl = (event: { url: string }) => {
      console.log("[SocialAuth] Linking event:", event.url);
      if (event.url?.startsWith(returnUrl)) {
        finished = true;
        subscription.remove();
        resolve({ type: "success", url: event.url });
      }
    };

    // ✅ modern subscription API
    const subscription = Linking.addEventListener("url", onUrl);

    // Open system browser
    try {
      await WebBrowser.openBrowserAsync(authUrl);
    } catch (e) {
      console.warn("[SocialAuth] openBrowserAsync failed", e);
    }

    // Timeout safeguard
    setTimeout(() => {
      if (!finished) {
        subscription.remove();
        resolve({ type: "error", error: "timeout" });
      }
    }, timeoutMs);
  });
}

/**
 * Extract query + fragment params from redirect URL
 */
function parseUrlParams(url: string): Record<string, string> {
  try {
    const [base, hash = ""] = url.split("#");
    const query = base.split("?")[1] ?? "";

    const parse = (s: string) =>
      Object.fromEntries(
        s
          .split("&")
          .map((p) => p.split("="))
          .filter(([k]) => k)
          .map(([k, v]) => [decodeURIComponent(k), decodeURIComponent(v ?? "")])
      );

    return { ...parse(query), ...parse(hash) };
  } catch {
    return {};
  }
}

/**
 * GOOGLE SIGN-IN
 */
export async function signInWithGoogleAsync(): Promise<
  { uid: string; idToken: string } | null
> {
  console.log("[SocialAuth] Google sign-in start, platform:", Platform.OS);

  // 🌐 WEB: Firebase popup (dynamically require to avoid initializing web auth on RN)
  if (Platform.OS === "web") {
    try {
      // runtime require so RN initializeAuth can run first
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getAuth, signInWithPopup, GoogleAuthProvider: GProvider } =
        require("firebase/auth");
      const provider = new GProvider();
      const result = await signInWithPopup(getAuth(), provider);
      const idToken = await result.user.getIdToken();
      return { uid: result.user.uid, idToken };
    } catch (e) {
      console.warn("[SocialAuth] Web Google popup failed", e);
      return null;
    }
  }

  // 📱 NATIVE
  try {
    const redirectUri = buildRedirectUri();
    console.log("[SocialAuth] Google redirectUri:", redirectUri);

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?response_type=token` +
      `&client_id=${encodeURIComponent(GOOGLE_CLIENT_ID_WEB)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("profile email")}`;

    const result: any = await startAuthFlow(authUrl, redirectUri);
    console.log("[SocialAuth] Google auth result:", result);

    if (!result || result.type !== "success") return null;

    const params = parseUrlParams(result.url);
    console.log("[SocialAuth] Google parsed params:", params);

    const accessToken = params.access_token;
    if (!accessToken) return null;

    const credential = GoogleAuthProvider.credential(null, accessToken);
    const userCred = await signInWithCredential(auth, credential); // use shared auth from config
    const idToken = await userCred.user.getIdToken();

    return { uid: userCred.user.uid, idToken };
  } catch (e) {
    console.warn("[SocialAuth] Google native flow failed", e);
    return null;
  }
}

/**
 * FACEBOOK SIGN-IN
 */
export async function signInWithFacebookAsync(): Promise<
  { uid: string; idToken: string } | null
> {
  console.log("[SocialAuth] Facebook sign-in start, platform:", Platform.OS);

  // 🌐 WEB
  if (Platform.OS === "web") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {
        getAuth,
        signInWithPopup,
        FacebookAuthProvider: FBProvider,
      } = require("firebase/auth");
      const provider = new FBProvider();
      const result = await signInWithPopup(getAuth(), provider);
      const idToken = await result.user.getIdToken();
      return { uid: result.user.uid, idToken };
    } catch (e) {
      console.warn("[SocialAuth] Web Facebook popup failed", e);
      return null;
    }
  }

  // 📱 NATIVE
  try {
    const redirectUri = buildRedirectUri();
    console.log("[SocialAuth] Facebook redirectUri:", redirectUri);

    const authUrl =
      `https://www.facebook.com/v15.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(FACEBOOK_APP_ID)}` +
      `&response_type=token` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("email public_profile")}`;

    const result: any = await startAuthFlow(authUrl, redirectUri);
    console.log("[SocialAuth] Facebook auth result:", result);

    if (!result || result.type !== "success") return null;

    const params = parseUrlParams(result.url);
    console.log("[SocialAuth] Facebook parsed params:", params);

    const accessToken = params.access_token;
    if (!accessToken) return null;

    const credential = FacebookAuthProvider.credential(accessToken);
    const userCred = await signInWithCredential(auth, credential); // use shared auth
    const idToken = await userCred.user.getIdToken();

    return { uid: userCred.user.uid, idToken };
  } catch (e) {
    console.warn("[SocialAuth] Facebook native flow failed", e);
    return null;
  }
}
