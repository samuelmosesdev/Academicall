import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { settingsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const SETTINGS_REF = doc(db, "settings", "platform");

export const DEFAULT_SETTINGS = {
  appName: "UofA Readers",
  tagline: "Learn smarter. Read better.",
  supportEmail: "support@uofa.edu",
  timezone: "Africa/Lagos",
  maintenanceMode: false,
  maintenanceMessage: "We're performing scheduled maintenance. Please check back shortly.",

  allowEmailPassword: true,
  allowGoogle: true,
  forceEmailVerification: true,
  requireProfileCompletion: true,
  minPasswordLength: 8,
  defaultRole: "user",
  uniqueIdPrefix: "UAR",

  freeTrialDays: 7,
  gracePeriodDays: 3,
  plans: [
    { id: "free", name: "Free", price: 0, interval: "forever" },
    { id: "monthly", name: "Monthly", price: 2500, interval: "month" },
    { id: "annual", name: "Annual", price: 20000, interval: "year" },
  ],

  modules: {
    readingHub: true,
    cbtBuilder: true,
    agents: true,
    announcements: true,
    payments: true,
  },
  maxUploadMb: 25,
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],

  adminEmailNotifications: true,
  studentWelcomeEmail: true,
  paymentFailedEmail: true,

  accentColor: "#2fd9a8",
  density: "comfortable",
};

export function usePlatformSettings() {
  const { authMode } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      settingsApi.get("platform").then(({ value }) => {
        if (!alive) return;
        if (value) setSettings({ ...DEFAULT_SETTINGS, ...value });
        setLoading(false);
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }
    const unsub = onSnapshot(
      SETTINGS_REF,
      (snap) => {
        if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
        else setSettings(DEFAULT_SETTINGS);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [authMode]);

  async function saveSettings(partial) {
    setSaving(true);
    try {
      const next = { ...settings, ...partial, updatedAt: new Date() };
      if (authMode === "api") await settingsApi.update("platform", next);
      else await setDoc(SETTINGS_REF, next, { merge: true });
      setSettings(next);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      setSaving(false);
    }
  }

  return { settings, loading, saving, saveSettings };
}