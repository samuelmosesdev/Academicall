import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";
import { isNativeApp } from "../lib/platform";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Loud guard: pointing a dev build at the production project is how a single
// runaway listener burns the whole team's daily quota. See
// docs/FIRESTORE-COST-POSTMORTEM.md.
const PROD_PROJECT_ID = "uofa-reader";
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true";

if (import.meta.env.DEV && !useEmulator && firebaseConfig.projectId === PROD_PROJECT_ID) {
  console.warn(
    `[firebase] Local dev is connected to the PRODUCTION project "${PROD_PROJECT_ID}". ` +
      "Every read/write here bills against the live quota. Point .env.development at a " +
      "dev project, or set VITE_USE_FIREBASE_EMULATOR=true."
  );
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Persistent (IndexedDB) cache instead of the default memory-only cache.
// Without this, every page reload re-fetches every listener's full result set
// from the server and is billed as a fresh read per document.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(app);

if (useEmulator) {
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";
  connectFirestoreEmulator(db, host, 8080);
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectStorageEmulator(storage, host, 9199);
  console.info(`[firebase] Using local emulators at ${host}`);
}

// Website: session only (logs out when browser session ends).
// Native app: stay logged in until the user signs out.
const persistence = isNativeApp()
  ? browserLocalPersistence
  : browserSessionPersistence;

setPersistence(auth, persistence).catch((err) => {
  console.warn("Could not set auth persistence:", err);
});

export let messaging = null;

isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  }
});
