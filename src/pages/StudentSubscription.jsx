import { useState } from "react";
import {
  Check,
  Crown,
  Sparkles,
  Zap,
  Palette,
  Brain,
  Shield,
  MessageCircle,
} from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useSubscriptionPlans } from "../hooks/useSubscriptionPlans";
import { usersApi } from "../lib/api";

export default function StudentSubscription() {
  const { user, profile, authMode } = useAuth();
  const { plans, loading, formatPrice } = useSubscriptionPlans();
  const isPaid = profile?.plan === "annual" || profile?.plan === "paid";
  const isMonthly = profile?.plan === "monthly";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function setPlan(plan) {
    if (!user) return;
    setBusy(true);
    setMessage("");
    try {
      if (authMode === "api") {
        await usersApi.updateMe({ plan });
      } else await updateDoc(doc(db, "users", user.uid), {
        plan,
        planUpdatedAt: serverTimestamp(),
      });
      const label =
        plan === "annual"
          ? plans.annual?.name || "Annual"
          : plan === "monthly"
            ? plans.monthly?.name || "Monthly"
            : plans.free?.name || "Free";
      setMessage(
        plan === "free"
          ? `Switched to ${label}.`
          : `${label} plan activated on your account. Enjoy the full HUB!`
      );
    } catch (err) {
      setMessage(err.message || "Could not update plan. Contact support.");
    } finally {
      setBusy(false);
    }
  }

  const symbol = plans.currencySymbol || "₦";
  const freeFeatures = plans.free?.features || [];
  const annualFeatures = plans.annual?.features || [];
  const monthlyFeatures = plans.monthly?.features || [];
  const showMonthly = Boolean(plans.monthly?.enabled);

  if (loading) {
    return (
      <p className="py-16 text-center text-sm text-text-muted">Loading plans…</p>
    );
  }

  const currentLabel = isPaid
    ? plans.annual?.name || "Annual"
    : isMonthly
      ? plans.monthly?.name || "Monthly"
      : plans.free?.name || "Free";

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-in">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/30">
          <Crown size={22} />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-text-primary">
          Plans & subscription
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          You are on the{" "}
          <span className="font-semibold text-accent">{currentLabel}</span> plan.
        </p>
      </div>

      {message && (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-center text-sm text-accent">
          {message}
        </div>
      )}

      <div
        className={`grid gap-5 ${showMonthly ? "md:grid-cols-3" : "md:grid-cols-2"}`}
      >
        {/* Free */}
        <div className="flex flex-col rounded-3xl border border-border-subtle bg-bg-panel p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
            {plans.free?.name || "Free"}
          </p>
          <p className="mt-2 text-3xl font-bold text-text-primary">
            {formatPrice(plans.free?.price ?? 0, symbol)}
            <span className="text-sm font-medium text-text-secondary">
              {" "}
              / {plans.free?.period || "forever"}
            </span>
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {freeFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>
          {!isPaid && !isMonthly ? (
            <button
              type="button"
              disabled
              className="mt-6 w-full rounded-2xl border border-border-subtle py-3 text-sm font-semibold text-text-muted"
            >
              Current plan
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPlan("free")}
              className="btn-ghost mt-6 w-full py-3"
            >
              Switch to Free
            </button>
          )}
        </div>

        {/* Annual */}
        <div className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-accent bg-bg-panel p-6 shadow-lg shadow-accent/15">
          {plans.annual?.badge && (
            <div className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bg-sidebar">
              {plans.annual.badge}
            </div>
          )}
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent">
            <Sparkles size={12} />
            {plans.annual?.name || "Annual"}
          </p>
          <p className="mt-2 text-3xl font-bold text-text-primary">
            {formatPrice(plans.annual?.price ?? 0, symbol)}
            <span className="text-sm font-medium text-text-secondary">
              {" "}
              / {plans.annual?.period || "year"}
            </span>
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {annualFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-text-primary">
                <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>
          {isPaid ? (
            <button
              type="button"
              disabled
              className="mt-6 w-full rounded-2xl bg-accent/20 py-3 text-sm font-semibold text-accent"
            >
              You&apos;re on {plans.annual?.name || "Annual"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPlan("annual")}
              className="btn-primary mt-6 w-full py-3"
            >
              {busy ? "Activating…" : `Upgrade to ${plans.annual?.name || "Annual"}`}
            </button>
          )}
        </div>

        {/* Monthly (if enabled by admin) */}
        {showMonthly && (
          <div className="flex flex-col rounded-3xl border border-border-subtle bg-bg-panel p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
              {plans.monthly?.name || "Monthly"}
            </p>
            <p className="mt-2 text-3xl font-bold text-text-primary">
              {formatPrice(plans.monthly?.price ?? 0, symbol)}
              <span className="text-sm font-medium text-text-secondary">
                {" "}
                / {plans.monthly?.period || "month"}
              </span>
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {monthlyFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
            {isMonthly ? (
              <button
                type="button"
                disabled
                className="mt-6 w-full rounded-2xl border border-border-subtle py-3 text-sm font-semibold text-text-muted"
              >
                Current plan
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setPlan("monthly")}
                className="btn-ghost mt-6 w-full py-3"
              >
                {busy ? "Activating…" : `Choose ${plans.monthly?.name || "Monthly"}`}
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-text-muted">
        Payment gateway coming soon. For manual upgrade, contact support on WhatsApp.
      </p>
      {plans.whatsappSupport && (
        <a
          href={plans.whatsappSupport}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto flex items-center justify-center gap-1.5 text-xs font-semibold text-accent"
        >
          <MessageCircle size={13} />
          WhatsApp support
        </a>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Brain, label: "AI questions from PDFs" },
          { icon: Palette, label: "Light & dark themes" },
          { icon: Zap, label: "Priority practice tools" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-panel px-4 py-3"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon size={18} />
            </span>
            <span className="text-sm font-medium text-text-primary">{label}</span>
          </div>
        ))}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
        <Shield size={12} /> Secure account · Cancel anytime · Support by emvisuals
      </p>
    </div>
  );
}
