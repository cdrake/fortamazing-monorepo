// src/lib/googleNativeAuth.ts
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "@/config/firebase";

GoogleSignin.configure({
  webClientId: "304795134519-9utqinr8p30spdobnmgckciqn7j7hlei.apps.googleusercontent.com", // keep your web client id here
  offlineAccess: false,
});

export async function signInWithGoogleNative() {
  // Ensure native Google services are available (Android mostly)
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // Prompt the native Google sign-in UI
  const userInfo = await GoogleSignin.signIn();

  // Immediately fetch tokens in a typed-safe way
  const tokens = await GoogleSignin.getTokens();

  // tokens.idToken is the piece Firebase expects
  const idToken = tokens.idToken;
  if (!idToken) {
    // Provide helpful error text so you can debug (TestFlight, etc.)
    throw new Error(
      "Google Sign-In failed: no idToken returned. tokens: " + JSON.stringify(tokens),
    );
  }

  // Build a Firebase credential from the native id token and sign the user in
  const credential = GoogleAuthProvider.credential(idToken);
  const userCred = await signInWithCredential(auth, credential);

  return userCred;
}
