import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "../firebase/config";
import { api, notificationsApi, usersApi } from "./api";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Keep the same token from being re-registered in a single browser session.
const writtenTokens = new Set();

async function persistFcmTokenViaApi(uid, token) {
  const payload = { uid, token, platform: "web" };
  const candidates = [
    () => usersApi.updateMe({ fcmToken: token, fcmTokenPlatform: "web" }),
    () => usersApi.updateMe({ deviceToken: token, devicePlatform: "web" }),
    () => notificationsApi.registerDeviceToken({ uid, token, platform: "web" }),
    () => notificationsApi.registerFcmToken({ uid, token, platform: "web" }),
    () => api("/users/me/device-token", { method: "POST", body: payload }),
    () => api("/users/me/fcm-token", { method: "POST", body: payload }),
    () => api("/notifications/device-token", { method: "POST", body: payload }),
    () => api("/notifications/fcm-token", { method: "POST", body: payload }),
  ];

  let lastError = null;

  for (const candidate of candidates) {
    try {
      const response = await candidate();
      if (response && response.ok !== false) {
        return true;
      }
    } catch (err) {
      lastError = err;
    }
  }

  console.warn("FCM token API registration failed:", lastError || "unknown error");
  return false;
}

/**
 * Ask for permission and save the device token via the app API instead of
 * writing to Firestore directly, which can trigger churn and quota leaks.
 */
export async function registerFcmToken(uid) {
  if (!messaging || !uid || !VAPID_KEY) {
    console.warn("FCM not available");
    return null;
  }

  try {
    if (typeof Notification === "undefined") {
      console.warn("Browser notifications are not supported in this environment.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return null;
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return null;

    const tokenKey = `${uid}:${token}`;
    if (writtenTokens.has(tokenKey)) {
      return token;
    }

    const stored = await persistFcmTokenViaApi(uid, token);
    if (stored) {
      writtenTokens.add(tokenKey);
      console.log("FCM token saved via API");
    }

    return token;
  } catch (err) {
    console.error("FCM registration error:", err);
    return null;
  }
}

/**
 * Listen for messages while the app is open (foreground)
 */
export function listenForForegroundMessages(onReceive) {
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log("Foreground message received:", payload);
    if (onReceive) onReceive(payload);
  });
}