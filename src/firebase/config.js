import { initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

// Firebase is now used ONLY for optional web-push (FCM) on the frontend.
// Auth and Firestore were removed as part of retiring hybrid auth — the
// Academicall API + Postgres is the single source of truth for accounts
// and data. See src/context/AuthContext.jsx for the API-based auth flow.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

export let app = null;
export let messaging = null;

// Legacy stubs: a handful of unreachable fallback code paths (dead code from
// the pre-migration Firestore version, gated behind `authMode !== "api"`,
// which never happens once signed in) still import these two names. They
// are intentionally null now that Auth/Firestore are gone — safe to delete
// those dead branches entirely in a follow-up cleanup.
export const auth = null;
export const db = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    isSupported().then((supported) => {
      if (supported) {
        messaging = getMessaging(app);
      }
    });
  } catch (err) {
    console.warn("[firebase] init skipped:", err?.message || err);
  }
} else {
  console.info("[firebase] not configured — push notifications disabled. This is expected; auth and data use the API.");
}
