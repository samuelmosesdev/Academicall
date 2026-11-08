import { deleteToken, getToken, onMessage } from "firebase/messaging";
import { firebaseConfigured, getMessagingClient } from "../firebase/config";
import { meApi } from "./gapsApi";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const TOKEN_KEY = "ac.web.push.token";

export function browserPushAvailability() {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    typeof Notification === "undefined" ||
    !("serviceWorker" in navigator)
  ) return "unsupported";
  if (!firebaseConfigured() || !VAPID_KEY) return "unconfigured";
  return "available";
}

export function browserPushRegistered() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export async function registerFcmToken(uid, { requestPermission = false } = {}) {
  if (!uid) throw new Error("Sign in before enabling browser notifications.");
  const availability = browserPushAvailability();
  if (availability === "unsupported") throw new Error("This browser cannot receive web notifications.");
  if (availability === "unconfigured") {
    throw new Error("Browser notifications are not configured for this deployment. Contact support.");
  }

  if (Notification.permission === "default" && requestPermission) {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") {
    throw new Error(
      Notification.permission === "denied"
        ? "Notifications are blocked in this browser. Allow them in the browser's site settings."
        : "Allow notifications from the button in Settings to continue."
    );
  }

  const messaging = await getMessagingClient();
  if (!messaging) throw new Error("Firebase messaging is not supported in this browser.");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Firebase did not return a browser notification token.");

  const previousToken = localStorage.getItem(TOKEN_KEY);
  await meApi.registerDevice({ token, platform: "web" });
  if (previousToken && previousToken !== token) {
    await meApi.removeDevice(previousToken);
  }
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export async function unregisterFcmToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await meApi.removeDevice(token);
  localStorage.removeItem(TOKEN_KEY);

  const messaging = await getMessagingClient();
  if (messaging) await deleteToken(messaging);
}

export async function listenForForegroundMessages(onReceive) {
  const messaging = await getMessagingClient();
  if (!messaging) return () => {};
  return onMessage(messaging, onReceive);
}