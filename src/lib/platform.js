import { Capacitor } from "@capacitor/core";

/** True when running inside the Android/iOS app (not the website browser). */
export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
