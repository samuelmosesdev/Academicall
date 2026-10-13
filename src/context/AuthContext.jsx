import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authApi, usersApi } from "../lib/api";
import { registerFcmToken } from "../lib/fcm";
import { startRealtime, stopRealtime } from "../lib/realtime";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [verificationEmailStatus, setVerificationEmailStatus] = useState(null);
  // authMode is always "api" once signed in — kept for backwards
  // compatibility with components that still branch on it.
  const [authMode, setAuthMode] = useState(null); // "api" | null
  const fcmRegisteredRef = useRef(false);

  const applySession = useCallback((data) => {
    const nextUser = { ...data.user, uid: data.user.id };
    localStorage.setItem("academicall_token", data.token);
    setUser(nextUser);
    setProfile(nextUser);
    setAuthMode("api");
    setProfileReady(true);
    setLoading(false);
    return data;
  }, []);

  // ---------- API Auth (email/password) ----------
  const loginWithApi = async (identifier, password) => {
    const data = await authApi.login({ identifier, password });
    return applySession(data);
  };

  const registerWithApi = async (email, password, name) => {
    const data = await authApi.register({ email, password, name });
    applySession(data);
    try {
      await resendVerificationEmail();
    } catch (err) {
      console.warn("Verification email could not be sent during signup:", err);
    }
    return data;
  };

  // ---------- Google sign-in (Google Identity Services, no Firebase) ----------
  const signInWithGoogle = useCallback(async (credential) => {
    if (!credential) throw new Error("Google did not return a sign-in credential. Please try again.");
    const data = await authApi.google(credential);
    return applySession(data);
  }, [applySession]);

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
    const data = await authApi.me();
    setUser({ ...data.user, uid: data.user.id });
    setProfile({ ...data.user, uid: data.user.id });
    return Boolean(data.user.emailVerified);
  };

  // Re-fetches /users/me and syncs it into state. Needed anywhere the backend
  // changes a flag on the current user (e.g. mustChangePassword flips to
  // false after ForceChangePassword) — without this, ProtectedRoute keeps
  // reading the stale value from context and bounces the user right back.
  const refreshProfile = async () => {
    const data = await authApi.me();
    const nextUser = { ...data.user, uid: data.user.id };
    setUser(nextUser);
    setProfile(nextUser);
    return nextUser;
  };

  const resendVerificationEmail = async () => {
    try {
      const data = await authApi.sendVerification();
      setVerificationEmailStatus("sent");
      return data;
    } catch (err) {
      setVerificationEmailStatus("failed");
      throw err;
    }
  };

  const verifyEmailWithCode = async (code) => {
    const data = await authApi.verifyEmail(code);
    setUser((current) => (current ? { ...current, emailVerified: true } : current));
    setProfile((current) => (current ? { ...current, emailVerified: true } : current));
    return data;
  };

  const logout = async () => {
    fcmRegisteredRef.current = false;
    stopRealtime();
    localStorage.removeItem("academicall_token");
    setUser(null);
    setProfile(null);
    setProfileReady(false);
    setAuthMode(null);
    setVerificationEmailStatus(null);
  };

  const scopeKey = `${profile?.institutionId || ""}|${profile?.program || ""}|${profile?.department || ""}|${profile?.level || ""}|${profile?.role || ""}`;
  useEffect(() => {
    if (user?.uid && authMode) startRealtime();
    else stopRealtime();
  }, [user?.uid, authMode, scopeKey]);

  // ---------- FCM (web push) registration once logged in ----------
  useEffect(() => {
    if (!profileReady || !user?.uid || !authMode || fcmRegisteredRef.current) return;

    fcmRegisteredRef.current = true;
    registerFcmToken(user.uid).catch((err) => {
      console.warn("FCM registration skipped:", err);
      fcmRegisteredRef.current = false;
    });
  }, [profileReady, user?.uid, authMode]);

  // ---------- Initial load: restore session from stored JWT ----------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = localStorage.getItem("academicall_token");
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setAuthMode(null);
          setProfileReady(true);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await authApi.me();
        if (cancelled) return;
        setUser({ ...data.user, uid: data.user.id });
        setProfile({ ...data.user, uid: data.user.id });
        setAuthMode("api");
      } catch (err) {
        console.warn("Stored session invalid, clearing...", err);
        localStorage.removeItem("academicall_token");
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setAuthMode(null);
        }
      } finally {
        if (!cancelled) {
          setProfileReady(true);
          setLoading(false);
        }
      }
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
    verificationEmailStatus,
    loginWithApi,
    registerWithApi,
    signInWithGoogle,
    completeProfile,
    refreshEmailVerified,
    refreshProfile,
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
