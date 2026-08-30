import { createContext, useContext, useEffect, useRef, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { authApi, usersApi } from "../lib/api";
import { registerFcmToken } from "../lib/fcm";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [authMode, setAuthMode] = useState(null); // "api" | "firebase" | null
  const fcmRegisteredRef = useRef(false);

  const syncFirebaseSession = async (firebaseUser) => {
    const data = await authApi.firebase(await firebaseUser.getIdToken());
    data.user = { ...data.user, uid: data.user.id };
    localStorage.setItem("academicall_token", data.token);
    setUser(data.user);
    setProfile(data.user);
    setAuthMode("api");
    setProfileReady(true);
    setLoading(false);
    return firebaseUser;
  };

  // ---------- API Auth ----------
  const loginWithApi = async (identifier, password) => {
    const data = await authApi.login({ identifier, password });
    data.user = { ...data.user, uid: data.user.id };
    localStorage.setItem("academicall_token", data.token);
    setUser(data.user);
    setProfile(data.user);
    setAuthMode("api");
    setProfileReady(true);
    setLoading(false);
    return data;
  };

  const registerWithApi = async (email, password, name) => {
    const data = await authApi.register({ email, password, name });
    data.user = { ...data.user, uid: data.user.id };
    localStorage.setItem("academicall_token", data.token);
    setUser(data.user);
    setProfile(data.user);
    setAuthMode("api");
    setProfileReady(true);
    setLoading(false);
    try {
      await authApi.sendVerification();
    } catch (err) {
      console.warn("Verification email could not be sent during signup:", err);
    }
    return data;
  };

  const signInWithGoogle = async () => {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    return syncFirebaseSession(credential.user);
  };

  const completeProfile = async (details) => {
    if (authMode !== "api") throw new Error("Profile completion is unavailable for this sign-in method.");
    const data = await usersApi.updateMe({
      ...details,
      photoUrl: details.photoURL || details.photoUrl || null,
      profileComplete: true,
    });
    setUser(data.user);
    setProfile(data.user);
    return data.user.uniqueId;
  };

  const refreshEmailVerified = async () => {
    if (authMode === "api") {
      const data = await authApi.me();
      setUser({ ...data.user, uid: data.user.id });
      setProfile({ ...data.user, uid: data.user.id });
      return Boolean(data.user.emailVerified);
    }
    return Boolean(auth.currentUser?.emailVerified);
  };

  const resendVerificationEmail = async () => {
    if (authMode === "api") return authApi.sendVerification();
  };

  const verifyEmailWithCode = async (code) => {
    if (authMode === "api") {
      const data = await authApi.verifyEmail(code);
      setUser((current) => (current ? { ...current, emailVerified: true } : current));
      setProfile((current) => (current ? { ...current, emailVerified: true } : current));
      return data;
    }
    throw new Error("Email verification is unavailable.");
  };

  const logout = async () => {
    fcmRegisteredRef.current = false;
    localStorage.removeItem("academicall_token");
    setUser(null);
    setProfile(null);
    setProfileReady(false);
    setAuthMode(null);
    try {
      await firebaseSignOut(auth);
    } catch (_) {}
  };

  // ---------- Initial load ----------
  useEffect(() => {
    if (!profileReady || !user?.uid || !authMode || fcmRegisteredRef.current) return;

    fcmRegisteredRef.current = true;
    registerFcmToken(user.uid).catch((err) => {
      console.warn("FCM registration skipped:", err);
      fcmRegisteredRef.current = false;
    });
  }, [profileReady, user?.uid, authMode]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = localStorage.getItem("academicall_token");

      const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        if (cancelled) return;

        if (firebaseUser) {
          try {
            await syncFirebaseSession(firebaseUser);
          } catch (err) {
            console.error("API Google session error:", err);
            if (token) {
              try {
                const data = await authApi.me();
                if (cancelled) return;
                setUser({ ...data.user, uid: data.user.id });
                setProfile({ ...data.user, uid: data.user.id });
                setAuthMode("api");
              } catch (tokenErr) {
                console.warn("API token invalid, clearing...", tokenErr);
                localStorage.removeItem("academicall_token");
                await firebaseSignOut(auth);
                setUser(null);
                setProfile(null);
                setAuthMode(null);
              }
            } else {
              await firebaseSignOut(auth);
              setUser(null);
              setProfile(null);
              setAuthMode(null);
            }
          }
        } else if (token) {
          try {
            const data = await authApi.me();
            if (cancelled) return;
            setUser({ ...data.user, uid: data.user.id });
            setProfile({ ...data.user, uid: data.user.id });
            setAuthMode("api");
          } catch (err) {
            console.warn("API token invalid, clearing...", err);
            localStorage.removeItem("academicall_token");
            setUser(null);
            setProfile(null);
            setAuthMode(null);
          }
        } else {
          setUser(null);
          setProfile(null);
          setAuthMode(null);
        }

        setProfileReady(true);
        setLoading(false);
      });

      return () => unsub();
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = {
    user,
    profile,
    loading,
    profileReady,
    authMode,
    loginWithApi,
    registerWithApi,
    signInWithGoogle,
    completeProfile,
    refreshEmailVerified,
    resendVerificationEmail,
    verifyEmailWithCode,
    logout,
    // compatibility aliases
    currentUser: user,
    signInWithEmail: loginWithApi,
    signUp: registerWithApi,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);