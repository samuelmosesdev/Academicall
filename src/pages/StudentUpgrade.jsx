import { useState } from "react";
import {
  Check,
  Crown,
  Sparkles,
  ExternalLink,
  Shield,
  Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePaymentSettings } from "../hooks/usePaymentSettings";
import { PRO_FEATURES, isPro, planLabel } from "../lib/subscription";
import { paymentsApi, notificationsApi } from "../lib/api";

export default function StudentUpgrade() {
  const { user, profile, authMode } = useAuth();
  const { settings, plans, loading } = usePaymentSettings();
  const pro = isPro(profile);
  const [claiming, setClaiming] = useState(null);
  const [claimMsg, setClaimMsg] = useState("");
  const [claimOk, setClaimOk] = useState(false);

  async function openCheckout(plan) {
    setClaimMsg("");
    if (!plan.url) {
      setClaimMsg(`${plan.name} payment link is not ready yet. Check back soon or contact admin.`);
      return;
    }
    // Record intent so admin can match payment → student quickly
    if (user) {
      try {
        const payload = {
          userId: user.uid,
          email: profile?.email || user.email || "",
          name: profile?.name || profile?.nickname || "",
          uniqueId: profile?.uniqueId || null,
          planId: plan.id,
          planName: plan.name,
          amountLabel: plan.amountLabel,
          status: "clicked_checkout",
        };
        if (authMode === "api") await paymentsApi.createClaim({ plan: plan.id, meta: payload });
      } catch {
        /* non-blocking */
      }
    }
    window.open(plan.url, "_blank", "noopener,noreferrer");
  }

  async function markPaid(plan) {
    if (!user) return;
    setClaiming(plan.id);
    setClaimMsg("");
    setClaimOk(false);
    try {
      const payload = {
        userId: user.uid,
        email: profile?.email || user.email || "",
        name: profile?.name || profile?.nickname || "",
        uniqueId: profile?.uniqueId || null,
        department: profile?.department || null,
        faculty: profile?.faculty || null,
        level: profile?.level || null,
        phone: profile?.phone || null,
        planId: plan.id,
        planName: plan.name,
        amountLabel: plan.amountLabel,
        // Must stay in the allowed set in firestore.rules
        status: "awaiting_review",
      };
      if (authMode !== "api") {
        setClaimMsg("Payment reporting will be available after this account is migrated to the Academicall API.");
        return;
      }
      await paymentsApi.createClaim({ plan: plan.id, meta: payload });
      // Surface in admin notification bell (best-effort)
      try {
        await notificationsApi.create({
          type: "payment_claim",
          title: "Student reported a payment",
          body: `${profile?.name || profile?.nickname || user.email || "A student"} says they paid for ${plan.name} (${plan.amountLabel || plan.id}). Review under Payments.`,
          data: { fromUserId: user.uid, fromUserName: profile?.name || profile?.nickname || "", fromUserEmail: profile?.email || user.email || "", planId: plan.id, planName: plan.name },
        });
      } catch {
        /* claim already saved — notification is best-effort */
      }
      setClaimOk(true);
      setClaimMsg(
        "Submitted — we received your report. Admin will activate Pro after verifying your Paystack payment."
      );
    } catch (err) {
      console.error("markPaid failed", err);
      setClaimOk(false);
      const code = err?.code || "";
      const msg =
        code === "permission-denied"
          ? "Could not submit (permission denied). Ask admin to update Firestore rules for paymentClaims, then try again."
          : err?.message || "Could not submit. Try again or message admin.";
      setClaimMsg(msg);
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-teal/20 bg-gradient-to-br from-[#0b3d36] via-[#0f7a6c] to-[#14b8a6] p-6 text-white shadow-lg sm:p-10">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles size={13} />
            {pro ? "You're on Pro" : "Choose a plan"}
          </div>
          <h1 className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
            {pro ? "Full access unlocked" : settings.headline || "Go Pro"}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/85 sm:text-base">
            {pro
              ? "Every course, document, timed practice, and the class timetable is open for you."
              : settings.subheadline ||
                "Weekly ₦500 · Monthly ₦1,500 · Annual ₦4,000 (best value)."}
          </p>
        </div>
      </section>

      {pro ? (
        <div className="flex items-start gap-3 rounded-2xl border border-teal/30 bg-teal-soft p-5">
          <Crown className="mt-0.5 shrink-0 text-teal" size={22} />
          <div>
            <p className="font-semibold text-ink">Pro active · {planLabel(profile)}</p>
            <p className="mt-1 text-sm text-ink-muted">
              Timetable, unlimited CBT, and all materials are available on your account.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => {
              const live = Boolean(plan.url);
              const isAnnual = plan.id === "annual";
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border bg-card-light p-5 ${
                    isAnnual
                      ? "border-2 border-teal shadow-[0_12px_40px_rgba(15,122,108,0.15)]"
                      : "border-border-light"
                  }`}
                >
                  {isAnnual && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal px-3 py-0.5 text-[11px] font-bold text-white">
                      BEST VALUE
                    </span>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {plan.name}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-ink">
                    {loading ? "…" : plan.amountLabel}
                  </p>
                  <p className="text-xs text-ink-muted">{plan.period}</p>
                  <p className="mt-3 flex-1 text-sm text-ink-muted">{plan.description}</p>

                  <button
                    type="button"
                    disabled={!live}
                    onClick={() => openCheckout(plan)}
                    className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      live
                        ? isAnnual
                          ? "bg-teal text-white hover:bg-teal-dark"
                          : "border-2 border-teal text-teal hover:bg-teal-soft"
                        : "cursor-not-allowed bg-surface-light text-ink-muted"
                    }`}
                  >
                    {live ? (
                      <>
                        Pay with Paystack <ExternalLink size={14} />
                      </>
                    ) : (
                      "Link coming soon"
                    )}
                  </button>

                  {live && (
                    <button
                      type="button"
                      disabled={claiming === plan.id}
                      onClick={() => markPaid(plan)}
                      className="mt-2 text-xs font-medium text-teal hover:underline disabled:opacity-60"
                    >
                      {claiming === plan.id ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" /> Sending…
                        </span>
                      ) : (
                        "I've already paid — notify admin"
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {claimMsg && (
            <p
              className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                claimOk
                  ? "border-teal/40 bg-teal-soft text-ink"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
              role="status"
            >
              {claimOk ? "✓ " : ""}
              {claimMsg}
            </p>
          )}

          <div className="rounded-2xl border border-border-light bg-card-light p-5">
            <h3 className="text-sm font-semibold text-ink">What Pro includes</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-ink">
                  <Check size={16} className="mt-0.5 shrink-0 text-teal" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-start gap-2 text-xs text-ink-muted">
              <Shield size={14} className="mt-0.5 shrink-0 text-teal" />
              Checkout is on Paystack. After you pay, Pro is activated once payment is confirmed
              (usually same day). Keep your receipt.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
