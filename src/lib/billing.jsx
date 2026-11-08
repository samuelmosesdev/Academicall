/**
 * Premium billing (web side). The admin decides which features are paid in
 * Admin → Billing; everything else stays free. Paid pages show a lock panel to
 * free accounts, and the API answers 402 premium_required (lib/billing.ts).
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { api } from "./api";
import { useAuth } from "../context/AuthContext";
import { isStaff } from "./roles";
import { featureForPath } from "./features";

export const billingApi = {
  get: () => api("/billing"),
  checkout: (planId) => api("/billing/checkout", { method: "POST", body: { planId } }),
  verify: (reference) => api(`/billing/verify/${encodeURIComponent(reference)}`),
  admin: () => api("/admin/billing"),
  save: (billing) => api("/admin/billing", { method: "PUT", body: billing }),
  grant: (userId, body) => api(`/admin/billing/users/${encodeURIComponent(userId)}`, { method: "PUT", body }),
};

/** Amounts are stored in naira everywhere (plans and payments). */
export const naira = (n) => `₦${Math.round(Number(n || 0)).toLocaleString("en-NG")}`;

/** Price per 30 days, used for "₦333 a month" and savings. */
export const perMonth = (plan) => (plan?.days ? (plan.amount / plan.days) * 30 : 0);

/** % saved against the plan with the highest monthly price. */
export function savingsPct(plan, plans = []) {
  const top = Math.max(...plans.map(perMonth), 0);
  if (!top || plans.length < 2) return 0;
  const pct = Math.round((1 - perMonth(plan) / top) * 100);
  return pct >= 5 ? pct : 0;
}

export function lengthLabel(days) {
  if (days === 7) return "week";
  if (days >= 28 && days <= 31) return "month";
  if (days >= 88 && days <= 92) return "3 months";
  if (days >= 180 && days <= 184) return "6 months";
  if (days >= 360 && days <= 366) return "year";
  return `${days} days`;
}

let cached = null;
const listeners = new Set();
function publish(state) {
  listeners.forEach((listener) => listener(state));
}

export async function loadBilling(fresh = false) {
  if (!fresh && cached) return cached;
  try {
    cached = await billingApi.get();
    publish({ data: cached, error: null, loading: false });
    return cached;
  } catch (error) {
    publish({ data: cached, error, loading: false });
    throw error;
  }
}

export function useBilling() {
  const { user } = useAuth();
  const [state, setState] = useState({ data: cached, error: null, loading: !cached });
  useEffect(() => {
    listeners.add(setState);
    loadBilling(true).catch((error) => setState({ data: cached, error, loading: false }));
    return () => listeners.delete(setState);
  }, [user?.uid, user?.id]);
  return state;
}

/** Mounted once beside FeatureRedirect: covers a paid page with a lock panel for free accounts. */
export function PremiumGate() {
  const { pathname } = useLocation();
  const { profile, user } = useAuth();
  const { data, error, loading, reload } = useBilling();
  const key = featureForPath(pathname);
  if (!user || !key || isStaff(profile)) return null;
  if (error || (!loading && !data)) {
    return (
      <div className="pm-lock" role="alert">
        <div className="pm-lock__card">
          <span className="pm-lock__icon"><Lock size={20} aria-hidden="true" /></span>
          <p className="pm-eyebrow mt-5">Access check unavailable</p>
          <h2 className="mt-2 font-display text-[1.65rem] leading-tight text-ink">We couldn't check Premium access</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{error?.message || "Billing information is unavailable."}</p>
          <button className="pm-btn pm-btn--ink mt-6" type="button" onClick={reload}>Try again</button>
        </div>
      </div>
    );
  }
  if (!data || !data.premium?.includes(key)) return null;
  if (isStaff(profile) || data.me?.active || data.me?.staff) return null;
  const label = data.features?.find((f) => f.key === key)?.label || "This page";
  const cheapest = [...(data.plans || [])].sort((a, b) => perMonth(a) - perMonth(b))[0];
  const others = (data.features || []).filter((f) => f.key !== key).slice(0, 3);
  return (
    <div className="pm-lock" role="dialog" aria-modal="true" aria-labelledby="pm-lock-title">
      <div className="pm-lock__card">
        <span className="pm-lock__icon"><Lock size={20} aria-hidden="true" /></span>
        <p className="pm-eyebrow mt-5">Premium feature</p>
        <h2 id="pm-lock-title" className="mt-2 font-display text-[1.65rem] leading-tight text-ink">{label} is part of Premium</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{data.page?.subheadline || "Upgrade to unlock it, along with every other premium tool."}</p>
        {others.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-ink">
            {others.map((f) => <li key={f.key} className="flex items-center gap-2"><Sparkles size={14} className="text-violet" aria-hidden="true" /> {f.label}</li>)}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link to="/dashboard/upgrade" className="pm-btn pm-btn--ink">
            {cheapest ? `See plans, from ${naira(perMonth(cheapest))}/month` : "See plans"} <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link to="/dashboard" className="pm-btn pm-btn--line">Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
