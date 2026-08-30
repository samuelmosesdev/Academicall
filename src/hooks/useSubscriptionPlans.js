import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { settingsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

/** Default plan config — used until admin saves real values in Firestore */
export const DEFAULT_PLANS = {
  currency: "NGN",
  currencySymbol: "₦",
  free: {
    name: "Free",
    price: 0,
    period: "forever",
    features: [
      "Access to Reading Hub materials",
      "Basic CBT practice",
      "Course selection & progress tracking",
      "Study streak on dashboard",
    ],
  },
  annual: {
    name: "Annual",
    price: 4999,
    period: "year",
    badge: "Popular",
    features: [
      "Everything in Free",
      "Unlimited AI-generated questions from PDFs",
      "Light & dark theme (Settings)",
      "Priority practice sets & full CBT history",
      "Advanced progress insights",
      "Early access to Timetable & new tools",
    ],
  },
  monthly: {
    name: "Monthly",
    price: 499,
    period: "month",
    enabled: false,
    features: [
      "Everything in Annual, billed monthly",
      "Cancel anytime",
    ],
  },
  whatsappSupport: "https://wa.me/2347060504211",
  updatedAt: null,
};

const DOC_REF = () => doc(db, "settings", "subscription");

/**
 * Live subscription pricing from Firestore `settings/subscription`.
 * Admin edits write the same document; students read it.
 */
export function useSubscriptionPlans() {
  const { authMode } = useAuth();
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      settingsApi.get("subscription").then(({ value }) => {
        if (!alive) return;
        if (value) setPlans({ ...DEFAULT_PLANS, ...value, free: { ...DEFAULT_PLANS.free, ...(value.free || {}) }, annual: { ...DEFAULT_PLANS.annual, ...(value.annual || {}) }, monthly: { ...DEFAULT_PLANS.monthly, ...(value.monthly || {}) } });
        setLoading(false);
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }
    const unsub = onSnapshot(
      DOC_REF(),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPlans({
            ...DEFAULT_PLANS,
            ...data,
            free: { ...DEFAULT_PLANS.free, ...(data.free || {}) },
            annual: { ...DEFAULT_PLANS.annual, ...(data.annual || {}) },
            monthly: { ...DEFAULT_PLANS.monthly, ...(data.monthly || {}) },
          });
        } else {
          setPlans(DEFAULT_PLANS);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("subscription settings:", err);
        setPlans(DEFAULT_PLANS);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [authMode]);

  async function savePlans(next) {
    setSaving(true);
    setError("");
    try {
      const payload = {
        currency: next.currency || "NGN",
        currencySymbol: next.currencySymbol || "₦",
        free: {
          name: next.free?.name || "Free",
          price: Number(next.free?.price) || 0,
          period: next.free?.period || "forever",
          features: Array.isArray(next.free?.features)
            ? next.free.features.filter(Boolean)
            : DEFAULT_PLANS.free.features,
        },
        annual: {
          name: next.annual?.name || "Annual",
          price: Number(next.annual?.price) || 0,
          period: next.annual?.period || "year",
          badge: next.annual?.badge || "Popular",
          features: Array.isArray(next.annual?.features)
            ? next.annual.features.filter(Boolean)
            : DEFAULT_PLANS.annual.features,
        },
        monthly: {
          name: next.monthly?.name || "Monthly",
          price: Number(next.monthly?.price) || 0,
          period: next.monthly?.period || "month",
          enabled: Boolean(next.monthly?.enabled),
          features: Array.isArray(next.monthly?.features)
            ? next.monthly.features.filter(Boolean)
            : DEFAULT_PLANS.monthly.features,
        },
        whatsappSupport: next.whatsappSupport || DEFAULT_PLANS.whatsappSupport,
        updatedAt: serverTimestamp(),
      };
      if (authMode === "api") await settingsApi.update("subscription", payload);
      else await setDoc(DOC_REF(), payload, { merge: true });
      return true;
    } catch (err) {
      setError(err.message || "Could not save plan settings.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function formatPrice(amount, symbol = plans.currencySymbol) {
    const n = Number(amount) || 0;
    return `${symbol || "₦"}${n.toLocaleString()}`;
  }

  return { plans, loading, saving, error, savePlans, formatPrice, setError };
}
