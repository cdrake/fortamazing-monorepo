// src/context/AuthContext.tsx
import React, {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMMKVString } from "react-native-mmkv";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth as firebaseAuth } from "@/config/firebase";

/**
 * AuthContext - mirrors firebase auth but preserves existing MMKV token/email storage.
 */
export type AuthContextType = {
  isAuthenticated: boolean;
  authToken?: string;
  authEmail?: string;
  setAuthToken: (token?: string) => void;
  setAuthEmail: (email: string) => void;
  logout: () => Promise<void>;
  validationError: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export interface AuthProviderProps {}

export const AuthProvider: FC<PropsWithChildren<AuthProviderProps>> = ({ children }) => {
  // Persisted storage (MMKV)
  const [authToken, setAuthTokenMMKV] = useMMKVString("AuthProvider.authToken");
  const [authEmail, setAuthEmailMMKV] = useMMKVString("AuthProvider.authEmail");

  // local flag indicating we've received the initial auth state from Firebase
  const [authReady, setAuthReady] = useState(false);

  // Compatibility wrappers
  const setAuthToken = useCallback(
    (token?: string) => {
      if (typeof token === "undefined") {
        setAuthTokenMMKV(undefined);
      } else {
        setAuthTokenMMKV(token);
      }
    },
    [setAuthTokenMMKV]
  );

  const setAuthEmail = useCallback(
    (email: string) => {
      setAuthEmailMMKV(email ?? "");
    },
    [setAuthEmailMMKV]
  );

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(firebaseAuth);
    } catch (e) {
      // ignore signOut errors
      console.warn("[AuthProvider] firebase signOut failed:", e);
    } finally {
      setAuthTokenMMKV(undefined);
      setAuthEmailMMKV("");
    }
  }, [setAuthEmailMMKV, setAuthTokenMMKV]);

  // Validation
  const validationError = useMemo(() => {
    if (!authEmail || authEmail.length === 0) return "can't be blank";
    if (authEmail.length < 6) return "must be at least 6 characters";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) return "must be a valid email address";
    return "";
  }, [authEmail]);

  // Subscribe to Firebase auth state and mirror into MMKV
  useEffect(() => {
    console.log("[AuthProvider] subscribing to onAuthStateChanged");
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      console.log("[AuthProvider] onAuthStateChanged user:", user?.uid ?? null);
      if (user) {
        try {
          const idToken = await user.getIdToken();
          setAuthTokenMMKV(idToken);
          setAuthEmailMMKV(user.email ?? "");
          console.log("[AuthProvider] stored idToken & email to MMKV");
        } catch (e) {
          console.warn("[AuthProvider] failed to get id token:", e);
          setAuthEmailMMKV(user.email ?? "");
          setAuthTokenMMKV(undefined);
        }
      } else {
        // user signed out / no persisted user
        setAuthTokenMMKV(undefined);
        setAuthEmailMMKV("");
        console.log("[AuthProvider] cleared MMKV (no firebase user)");
      }

      // mark that we've processed the initial state (this is important)
      if (!authReady) setAuthReady(true);
    });

    return () => unsub();
    // we intentionally do not include authReady in deps here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setAuthEmailMMKV, setAuthTokenMMKV]);

  // Delay rendering children until Firebase has restored auth persistence
  if (!authReady) {
    // You can return null or a loading component here
    return null;
  }

  const value: AuthContextType = {
    isAuthenticated: !!authToken,
    authToken,
    authEmail,
    setAuthToken,
    setAuthEmail,
    logout,
    validationError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
