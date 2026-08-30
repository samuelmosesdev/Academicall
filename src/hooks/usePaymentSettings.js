import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { DEFAULT_PLANS, resolvePlans } from "../lib/subscription";
import { settingsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const DEFAULTS = {
  headline: "Unlock Pro · exam-ready access",
  subheadline:
    "Choose Weekly, Monthly, or Annual. Annual (₦4,000) is the best value for a full session.",
  plans: {
    weekly: { url: "", amountLabel: "₦500", enabled: true },
    monthly: { url: "", amountLabel: "₦1,500", enabled: true },
    annual: {
      url: "https://paystack.shop/pay/5o79vdpr6a",
      amountLabel: "₦4,000",
      enabled: true,
    },
  },
  // legacy fields kept so older UI does not break
  priceLabel: "₦4,000 / year",
  priceNote: "Pay via Paystack · admin activates Pro after payment",
  selarUrl: "",
  remitaUrl: "",
  updatedAt: null,
};

export function usePaymentSettings() {
  const { authMode } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      settingsApi.get("payments").then(({ value }) => {
        if (!alive) return;
        if (value) setSettings({ ...DEFAULTS, ...value, plans: { ...DEFAULTS.plans, ...(value.plans || {}) } });
        setLoading(false);
      }).catch(() => alive && setLoading(false));
      return () => { alive = false; };
    }
    const unsub = onSnapshot(
      doc(db, "appSettings", "payments"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            ...DEFAULTS,
            ...data,
            plans: { ...DEFAULTS.plans, ...(data.plans || {}) },
          });
        } else {
          setSettings(DEFAULTS);
        }
        setLoading(false);
      },
      () => {
        setSettings(DEFAULTS);
        setLoading(false);
      }
    );
    return unsub;
  }, [authMode]);

  const plans = resolvePlans(settings);
  return { settings, plans, loading, defaults: DEFAULT_PLANS };
}
