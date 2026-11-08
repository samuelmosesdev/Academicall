/**
 * Push notifications in the Android app (Firebase Cloud Messaging via
 * @capacitor/push-notifications).
 *
 *  - After sign-in we ask for permission (Android 13+ shows the system prompt),
 *    register with FCM and send the device token to POST /me/devices.
 *  - Tapping a notification opens the page it links to (data.link).
 *  - On sign-out the token is removed so the next person on the phone doesn't
 *    get your alerts.
 *
 * Needs android/app/google-services.json from the Firebase console (see
 * docs/STAFF-AND-STUDENT-GAPS.md). Without it registration fails quietly.
 */
import { Capacitor } from "@capacitor/core";
import { meApi } from "./gapsApi";

const TOKEN_KEY = "ac.push.token";
let listenersAdded = false;

export function nativePushAvailable() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PushNotifications");
  } catch {
    return false;
  }
}

async function plugin() {
  const mod = await import("@capacitor/push-notifications");
  return mod.PushNotifications;
}

/** Open the page a notification links to, inside the app. */
function openLink(link) {
  if (!link || typeof link !== "string" || !link.startsWith("/")) link = "/dashboard/notifications";
  if (window.location.pathname + window.location.search !== link) window.location.assign(link);
}

export async function registerNativePush() {
  if (!nativePushAvailable()) return null;
  const Push = await plugin();
  if (!listenersAdded) {
    listenersAdded = true;
    await Push.addListener("registration", async ({ value }) => {
      try {
        await meApi.registerDevice({ token: value, platform: Capacitor.getPlatform() === "ios" ? "ios" : "android", appVersion: import.meta.env.VITE_APP_VERSION || undefined });
        localStorage.setItem(TOKEN_KEY, value);
      } catch (err) {
        console.warn("[push] could not save device token", err);
      }
    });
    await Push.addListener("registrationError", (err) => console.warn("[push] registration failed", err));
    await Push.addListener("pushNotificationActionPerformed", ({ notification }) => openLink(notification?.data?.link));
    // While the app is open, the in-app bell updates over the real-time stream; nothing extra to show.
  }
  try {
    await Push.createChannel({ id: "academicall", name: "Academicall", description: "Classes, tests, groups and news", importance: 4, visibility: 1, lights: true, vibration: true });
  } catch { /* older Android: channels not needed */ }
  let perm = await Push.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await Push.requestPermissions();
  if (perm.receive !== "granted") return null;
  await Push.register();
  return true;
}

export async function unregisterNativePush() {
  const token = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  if (token) await meApi.removeDevice(token).catch(() => {});
  if (nativePushAvailable()) {
    const Push = await plugin();
    await Push.unregister().catch(() => {});
  }
}

/** Current system permission, for the Settings screen. */
export async function nativePushPermission() {
  if (!nativePushAvailable()) return "unavailable";
  const Push = await plugin();
  return (await Push.checkPermissions()).receive;
}
