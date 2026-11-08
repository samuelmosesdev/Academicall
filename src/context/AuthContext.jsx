import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authApi, usersApi } from "../lib/api";
import { browserPushAvailability, listenForForegroundMessages, registerFcmToken, unregisterFcmToken } from "../lib/fcm";
import { registerNativePush, unregisterNativePush, nativePushAvailable } from "../lib/pushNative";
import { twoFactorApi } from "../lib/gapsApi";
import { startRealtime, stopRealtime } from "../lib/realtime";
import { setGroupsAccount } from "../hooks/useGroups";

const AuthContext = createContext(null);

/**
 * True when two profile payloads are identical. Background refreshes use this so
 * an unchanged profile keeps the SAME object identity: every effect, memo and
 * list that depends on `profile`/`user` then stays still instead of re-running
 * (which is what made the student dashboard flash a loading state every 30s).
 */
function sameProfile(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function isTwoFactorChallenge(data) {
  return data?.twoFactorRequired === true ||
    (typeof data?.challengeId === "string" && ["email", "totp"].includes(data.method));
}

function assertSessionResponse(data) {
  if (
    typeof data?.token !== "string" ||
    !data.token ||
    !data.user ||
    typeof data.user.id !== "string" ||
    !data.user.id
  ) {
    throw new Error("Sign-in returned an incomplete session. Please try again, or contact support if it continues.");
  }
}

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
    assertSessionResponse(data);
    const nextUser = { ...data.user, uid: data.user.id };
    localStorage.setItem("academicall_token", data.token);
    setUser(nextUser);
    setProfile(nextUser);
    setAuthMode("api");
    setProfileReady(true);
    setLoading(false);
    window.dispatchEvent(new Event("ac:signed-in"));
    return data;
  }, []);

  // ---------- API Auth (email/password) ----------
  /** Resolves to the session, or to { twoFactorRequired, challengeId, method, emailHint } when a code is needed. */
  const loginWithApi = async (identifier, password) => {
    const data = await authApi.login({ identifier, password });
    if (isTwoFactorChallenge(data)) return data;
    return applySession(data);
  };

  /** Second step of sign-in (email code, authenticator code or backup code). */
  const completeTwoFactor = useCallback(async (challengeId, code) => {
    const data = await twoFactorApi.verify(challengeId, code);
    return applySession(data);
  }, [applySession]);

  const registerWithApi = async (email, password, name, accountType = "student") => {
    const data = await authApi.register({ email, password, name, accountType });
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
    if (isTwoFactorChallenge(data)) return data;
    return applySession(data);
  }, [applySession]);

  const completeProfile = async (details) => {
    if (authMode !== "api") throw new Error("Profile completion is unavailable for this sign-in method.");
    const data = await usersApi.updateMe({
      ...details,
      photoUrl: details.photoURL || details.photoUrl || null,
      profileComplete: true,
    });
    const nextUser = { ...data.user, uid: data.user.id };
    setUser(nextUser);
    setProfile(nextUser);
    return data.user.uniqueId;
  };

  const refreshEmailVerified = async () => {
    const data = await authApi.me();
    const nextUser = { ...data.user, uid: data.user.id };
    setUser((current) => (sameProfile(current, nextUser) ? current : nextUser));
    setProfile((current) => (sameProfile(current, nextUser) ? current : nextUser));
    return Boolean(data.user.emailVerified);
  };

  // Re-fetches /users/me and syncs it into state. Needed anywhere the backend
  // changes a flag on the current user (e.g. mustChangePassword flips to
  // false after ForceChangePassword) — without this, ProtectedRoute keeps
  // reading the stale value from context and bounces the user right back.
  //
  // It is stable (useCallback) and only touches state when something actually
  // changed, so polling it is free: no re-render, no effect re-runs.
  const refreshProfile = useCallback(async () => {
    const data = await authApi.me();
    const nextUser = { ...data.user, uid: data.user.id };
    setUser((current) => (sameProfile(current, nextUser) ? current : nextUser));
    setProfile((current) => (sameProfile(current, nextUser) ? current : nextUser));
    return nextUser;
  }, []);

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
    // Stop this phone getting the next person's alerts.
    await unregisterNativePush().catch((err) => console.warn("[push] could not remove phone token", err));
    await unregisterFcmToken().catch((err) => console.warn("[push] could not remove browser token", err));
    fcmRegisteredRef.current = false;
    stopRealtime();
    setGroupsAccount(null);
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
    const shouldRegisterBrowserPush =
      browserPushAvailability() === "available" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted";
    const register = nativePushAvailable()
      ? registerNativePush()
      : shouldRegisterBrowserPush
        ? registerFcmToken(user.uid)
        : Promise.resolve();
    Promise.resolve(register).catch((err) => {
      console.warn("FCM registration skipped:", err);
      fcmRegisteredRef.current = false;
    });
  }, [profileReady, user?.uid, authMode]);

  useEffect(() => {
    if (!profileReady || !user?.uid || !authMode || nativePushAvailable()) return;

    let active = true;
    let unsubscribe = () => {};
    listenForForegroundMessages((payload) => {
      if (!active || typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const title = payload.notification?.title || "Academicall";
      const options = {
        body: payload.notification?.body || "",
        icon: "/logo-mint.png",
        badge: "/favicon.svg",
        data: payload.data || {},
      };
      navigator.serviceWorker.ready.then((registration) => registration.showNotification(title, options))
        .catch((err) => console.warn("[push] foreground notification could not be shown", err));
    }).then((stop) => {
      if (active) unsubscribe = stop;
      else stop();
    }).catch((err) => console.warn("[push] foreground listener unavailable", err));

    return () => {
      active = false;
      unsubscribe();
    };
  }, [profileReady, user?.uid, authMode]);

  // ---------- Initial load: restore session from stored JWT ----------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = localStorage.getItem("academicall_token");
      if (!token) {
        if (!cancelled) {
          setGroupsAccount(null);
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
        setGroupsAccount(null);
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

  // Memoised so consumers only re-render when auth state really changes. The
  // action functions close over `authMode` only (everything else is a stable
  // setter or API call), and `authMode` is a dependency, so they never go stale.
  /* eslint-disable react-hooks/exhaustive-deps */
  const value = useMemo(() => ({
    user,
    profile,
    loading,
    profileReady,
    authMode,
    verificationEmailStatus,
    loginWithApi,
    completeTwoFactor,
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
  }), [user, profile, loading, profileReady, authMode, verificationEmailStatus, completeTwoFactor, signInWithGoogle, refreshProfile]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
