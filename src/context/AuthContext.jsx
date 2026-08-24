import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { isBrevoVerifyConfigured, sendBrevoVerificationCode, verifyBrevoCode } from "../lib/brevoVerify";
// notifyCourseRep imported dynamically in completeProfile to avoid cycles;
import { registerFcmToken, listenForForegroundMessages } from "../lib/fcm";

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  signUp: async () => {},
  signInWithEmail: async () => {},
  signInWithGoogle: async () => {},
  resendVerificationEmail: async () => {},
  refreshEmailVerified: async () => false,
  completeProfile: async () => {},
  logout: async () => {},
});

function makeCandidateId() {
  const yy = String(new Date().getFullYear()).slice(-2);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `UAR-${yy}-${suffix}`;
}

async function generateUniqueId(uid, email) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = makeCandidateId();
    const lookupRef = doc(db, "idLookup", candidate);
    let existing;
    try {
      existing = await getDoc(lookupRef);
    } catch (err) {
      console.error("generateUniqueId: getDoc failed", err);
      throw new Error("Could not verify candidate ID due to network/permissions. Try again.");
    }
    if (!existing.exists()) {
      try {
        await setDoc(lookupRef, { uid, email, createdAt: serverTimestamp() });
        return candidate;
      } catch (err) {
        // If writing the lookup failed (race or permission), try next candidate
        console.warn("generateUniqueId: setDoc failed for candidate", candidate, err);
        continue;
      }
    }
  }
  throw new Error("Could not generate a unique ID. Please try again.");
}

function verificationRedirectUrl() {
  return { url: `${window.location.origin}/verify-email` };
}

async function rejectIfSuspended(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists() && snap.data().status === "suspended") {
    await signOut(auth);
    throw { code: "auth/user-disabled" };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setLoading(false);
      if (firebaseUser) {
        setUser(firebaseUser);
        setProfileReady(false);
      } else {
        // Clear immediately on sign-out so landing / protected routes never keep showing "Open dashboard"
        setUser(null);
        setProfile(null);
        setProfileReady(true);
      }
    });

    return () => unsub();
  }, []);

  // Keyed on uid, not the User object: Firebase hands back a new User instance
  // on token refresh / reload(), and re-attaching this listener re-bills a read
  // every time.
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setProfileReady(true);
      },
      () => {
        setProfile(null);
        setProfileReady(true);
      }
    );
    return unsub;
  }, [user?.uid]);

  // ========== FCM: Register token + listen for foreground messages ==========
  // These deps MUST stay primitive. `profile` is a fresh object on every
  // snapshot above, so depending on it here re-ran this effect after every
  // user-doc change — and registerFcmToken writes to that same doc, which
  // closed an unbounded write->snapshot->write loop.
  const fcmRegisteredFor = useRef(null);
  const emailVerifiedWritten = useRef(false);
  const role = profile?.role;

  useEffect(() => {
    if (!user || !profileReady) return;

    // Only register for students (role "user")
    const isStudent = role === "user" || role === "student" || !role;
    if (isStudent && fcmRegisteredFor.current !== user.uid) {
      fcmRegisteredFor.current = user.uid;
      registerFcmToken(user.uid);
    }
  }, [user?.uid, profileReady, role]);

  useEffect(() => {
    if (!user) return;
    // Listen for push messages while the app is open
    const unsubscribe = listenForForegroundMessages((payload) => {
      console.log("Foreground push received:", payload);
      // You can show a toast / in-app banner here later
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user?.uid]);

  async function signUp(email, password, name) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      name: name || "",
      role: "user",
      status: "active",
      plan: "free",
      subscription: "free",
      selectedCourseIds: [],
      emailVerified: false,
      profileComplete: false,
      uniqueId: null,
      createdAt: serverTimestamp(),
    });
    if (isBrevoVerifyConfigured()) {
      try {
        const idToken = await cred.user.getIdToken();
        await sendBrevoVerificationCode(idToken);
      } catch (e) {
        console.warn("Brevo send failed, falling back to Firebase email", e);
        await sendEmailVerification(cred.user, verificationRedirectUrl());
      }
    } else {
      await sendEmailVerification(cred.user, verificationRedirectUrl());
    }
    return cred.user;
  }

  async function signInWithEmail(identifier, password) {
    let email = identifier.trim();

    if (!email.includes("@")) {
      const lookupRef = doc(db, "idLookup", email.toUpperCase());
      const lookupSnap = await getDoc(lookupRef);
      if (!lookupSnap.exists()) {
        throw { code: "auth/user-not-found" };
      }
      email = lookupSnap.data().email;
    }

    const cred = await signInWithEmailAndPassword(auth, email, password);
    await rejectIfSuspended(cred.user.uid);
    return cred.user;
  }

  async function signInWithGoogle() {
    // Always use popup so auth stays inside the WebView / in-app browser (no full external redirect)
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    const ref = doc(db, "users", cred.user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email: cred.user.email,
        name: cred.user.displayName || "",
        role: "user",
        status: "active",
        plan: "free",
        subscription: "free",
        selectedCourseIds: [],
        emailVerified: cred.user.emailVerified,
        profileComplete: false,
        uniqueId: null,
        createdAt: serverTimestamp(),
      });
    } else {
      await rejectIfSuspended(cred.user.uid);
    }
    return cred.user;
  }

  async function completeProfile(details) {
    if (import.meta.env.DEV) {
      console.log("AuthContext.completeProfile called", { uid: auth.currentUser?.uid, details });
    }
    if (!auth.currentUser) throw new Error("Not signed in.");
    const uid = auth.currentUser.uid;
    const email = auth.currentUser.email;

    // NOTE: this used to write two `profileCompletionAudit` docs per signup
    // (attempt + outcome) purely to debug a past issue. Nothing read them.
    // Removed — that was 2 of the ~7 writes every registration cost.

    let uniqueId;
    try {
      uniqueId = await generateUniqueId(uid, email);
    } catch (err) {
      console.error("completeProfile: generateUniqueId failed", err);
      throw new Error(err.message || "Could not generate Unique ID. Try again later.");
    }

    const payload = {
      ...details,
      uniqueId,
      profileComplete: true,
      updatedAt: serverTimestamp(),
    };
    // Only set `role` if provided to avoid writing `undefined` (Firestore rejects undefined)
    if (details && typeof details.role !== "undefined" && details.role !== null) {
      payload.role = details.role;
    }

    try {
      await setDoc(doc(db, "users", uid), payload, { merge: true });
      // Notify Course Rep for this department + level (not whole department)
      try {
        const { notifyCourseRepOfNewStudent } = await import("../lib/notify");
        const name =
          auth.currentUser.displayName ||
          details?.name ||
          email ||
          "New student";
        await notifyCourseRepOfNewStudent({
          studentUid: uid,
          studentName: name,
          studentEmail: email,
          department: details?.department || payload.department,
          level: details?.level || payload.level,
          faculty: details?.faculty || payload.faculty,
        });
      } catch (notifyErr) {
        console.warn("completeProfile: course-rep notify failed", notifyErr);
      }
    } catch (err) {
      console.error("completeProfile: setDoc users failed", err);
      // The idLookup reservation for `uniqueId` is now orphaned. We can't
      // release it from the client — firestore.rules denies update+delete on
      // /idLookup (see rules line 95) — so the old cleanup write here only ever
      // produced a permission-denied round-trip. Dropped. Reclaiming orphans
      // needs a scheduled Cloud Function; the ID space is large enough that
      // leaking one per failed signup is tolerable meanwhile.
      throw new Error("Failed to save profile. Please try again.");
    }

    return uniqueId;
  }


  async function verifyEmailWithCode(code) {
    if (!auth.currentUser) throw new Error("Not signed in.");
    if (!isBrevoVerifyConfigured()) {
      throw new Error("Code verification requires Brevo (set VITE_VERIFY_API_URL).");
    }
    const idToken = await auth.currentUser.getIdToken(true);
    await verifyBrevoCode(idToken, code);
    await auth.currentUser.reload();
    return true;
  }

  async function logout() {
    // Clear local state first so UI (landing CTA, sidebars) updates instantly
    setUser(null);
    setProfile(null);
    setProfileReady(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("logout: signOut failed", err);
    }
  }

  async function resendVerificationEmail() {
    if (!auth.currentUser) throw new Error("Not signed in.");
    if (isBrevoVerifyConfigured()) {
      const idToken = await auth.currentUser.getIdToken(true);
      await sendBrevoVerificationCode(idToken);
      return;
    }
    await sendEmailVerification(auth.currentUser, verificationRedirectUrl());
  }

  async function refreshEmailVerified() {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const verified = auth.currentUser.emailVerified;
    // VerifyEmail polls this every 4s. Mirroring `emailVerified` into Firestore
    // on every tick was a write that changed nothing but still billed — and woke
    // every listener on the user doc. Write it once, only if it's not already set.
    if (verified && !emailVerifiedWritten.current && profile?.emailVerified !== true) {
      emailVerifiedWritten.current = true;
      await setDoc(doc(db, "users", auth.currentUser.uid), { emailVerified: true }, { merge: true });
    }
    return verified;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        profileReady,
        loading,
        signUp,
        signInWithEmail,
        signInWithGoogle,
        completeProfile,
        resendVerificationEmail,
        verifyEmailWithCode,
        refreshEmailVerified,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}