import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check, Loader2, ShieldCheck, Zap, RefreshCcw, ChevronDown, Crown, AlertCircle, CheckCircle2,
  BookOpen, CalendarClock, Brain, FolderLock, Newspaper, GraduationCap, Download, Search, Users, Layers, Mail,
} from "lucide-react";
import { billingApi, lengthLabel, loadBilling, naira, perMonth, savingsPct, useBilling } from "../lib/billing";
import "../billing.css";

const FEATURE_ICON = {
  courses: GraduationCap, programme: Users, groups: Users, materials: Layers, materialUploads: Layers, readingHub: BookOpen,
  timetable: CalendarClock, practice: Brain, utme: Brain, vault: FolderLock, news: Newspaper, results: GraduationCap,
  downloads: Download, tests: Brain, search: Search, reference: BookOpen,
};

export default function StudentUpgrade() {
  const { data, error, loading, reload } = useBilling();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) return undefined;

    let active = true;
    let verified = false;
    setBusy("verify");
    billingApi.verify(reference)
      .then((result) => {
        verified = true;
        if (active) {
          setMsg(result.status === "success"
            ? { ok: true, text: "Payment confirmed. Premium is on, enjoy." }
            : { ok: false, text: `Payment ${result.status}. Your plan has not been activated.` });
        }
      })
      .catch((verifyError) => {
        if (active) setMsg({ ok: false, text: verifyError.message || "We couldn't verify your payment. Reload this page to retry." });
      })
      .finally(() => {
        if (!active) return;
        setBusy("");
        if (verified) {
          const next = new URLSearchParams(params);
          next.delete("reference");
          next.delete("trxref");
          setParams(next, { replace: true });
          loadBilling(true).catch((refreshError) => {
            setMsg((current) => current?.ok
              ? { ...current, text: `${current.text} Refresh the page if your membership status does not update.` }
              : { ok: false, text: refreshError.message || "Billing information could not be refreshed." });
          });
        }
      });

    return () => { active = false; };
  }, [params, setParams]);

  async function pay(plan) {
    setBusy(plan.id);
    setMsg(null);
    try {
      const { url } = await billingApi.checkout(plan.id);
      window.location.assign(url);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
      setBusy("");
    }
  }

  const plans = useMemo(() => [...(data?.plans || [])].sort((a, b) => a.days - b.days), [data]);

  if (loading && !data) {
    return (
      <div className="pm mx-auto max-w-5xl space-y-6 p-4 sm:p-6" aria-busy="true">
        <div className="pm-skel h-56" />
        <div className="grid gap-4 md:grid-cols-3"><div className="pm-skel h-80" /><div className="pm-skel h-80" /><div className="pm-skel h-80" /></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="pm mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <p className="pm-note pm-note--err" role="alert"><AlertCircle size={16} /> {error.message || "Billing information is unavailable."}</p>
        <button className="pm-btn pm-btn--ink" type="button" onClick={reload}>Try again</button>
      </div>
    );
  }

  const { page = {}, features = [], me } = data;
  const active = !!me?.active;
  const ends = me?.endsAt ? new Date(me.endsAt) : null;
  const daysLeft = ends ? Math.max(0, Math.ceil((ends - Date.now()) / 86400000)) : null;
  const currentPlan = plans.find((p) => p.id === me?.planId);
  const progress = daysLeft != null && currentPlan ? Math.min(100, Math.max(4, (daysLeft / currentPlan.days) * 100)) : null;

  return (
    <div className="pm mx-auto max-w-5xl p-4 sm:p-6">
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="pm-hero">
        <div className="relative z-[1] max-w-xl">
          <span className="pm-chip"><Crown size={13} aria-hidden="true" /> {active ? "You're on Premium" : "Academicall Premium"}</span>
          <h1 className="mt-5 font-display text-[2.2rem] leading-[1.05] tracking-[-0.02em] sm:text-[3rem]">
            {active ? <>Everything is <span className="serif-i text-lemon">unlocked.</span></> : (page.headline || "Study with every tool switched on.")}
          </h1>
          <p className="mt-3 max-w-lg text-[0.98rem] leading-relaxed text-white/75">
            {active ? "Thanks for supporting Academicall. Paying again adds time to the end of your plan." : (page.subheadline || "One payment, no auto-renewal. Your plan starts the moment Paystack confirms it.")}
          </p>
        </div>

        {active ? (
          <div className="pm-member">
            <div className="flex items-center justify-between">
              <span className="pm-eyebrow !text-midnight/60">Membership</span>
              <Crown size={18} aria-hidden="true" />
            </div>
            <p className="mt-6 font-display text-2xl">{currentPlan?.name || "Premium"}</p>
            <p className="text-sm text-midnight/70">{ends ? `Active until ${ends.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}` : "Active, no end date"}</p>
            {progress != null && (
              <div className="mt-5">
                <div className="h-1.5 overflow-hidden rounded-full bg-midnight/15"><div className="h-full rounded-full bg-midnight" style={{ width: `${progress}%` }} /></div>
                <p className="mt-2 text-xs font-medium text-midnight/70">{daysLeft} day{daysLeft === 1 ? "" : "s"} left</p>
              </div>
            )}
          </div>
        ) : (
          <ul className="pm-hero-list" aria-label="Why Premium">
            <li><Zap size={16} aria-hidden="true" /> Starts instantly after payment</li>
            <li><RefreshCcw size={16} aria-hidden="true" /> No auto-renewal, ever</li>
            <li><ShieldCheck size={16} aria-hidden="true" /> Secure checkout by Paystack</li>
          </ul>
        )}
      </section>

      {/* ── Messages ─────────────────────────────────────── */}
      <div className="mt-5 space-y-2" aria-live="polite">
        {busy === "verify" && <p className="pm-note pm-note--info"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Confirming your payment with Paystack…</p>}
        {msg && (
          <p className={`pm-note ${msg.ok ? "pm-note--ok" : "pm-note--err"}`} role="status">
            {msg.ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />} {msg.text}
          </p>
        )}
        {error && data && <p className="pm-note pm-note--err" role="alert"><AlertCircle size={16} /> {error.message || "Billing information could not be refreshed."} <button className="ml-auto underline" type="button" onClick={reload}>Retry</button></p>}
        {!data.ready && plans.length > 0 && <p className="pm-note pm-note--info"><AlertCircle size={16} aria-hidden="true" /> Payments open soon. You can look around in the meantime.</p>}
      </div>

      {/* ── Plans ────────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="pm-plans">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="pm-eyebrow">{active ? "Extend your plan" : "Choose a plan"}</p>
            <h2 id="pm-plans" className="mt-1 font-display text-2xl text-ink sm:text-[1.9rem]">Simple pricing for the whole session</h2>
          </div>
          <p className="text-xs text-ink-muted">Prices in naira. One-off payment.</p>
        </div>

        {plans.length === 0 ? (
          <div className="pm-empty mt-6">No plans are on sale right now. Check back soon.</div>
        ) : (
          <div className={`mt-6 grid gap-5 ${plans.length === 1 ? "max-w-md" : plans.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            {plans.map((p) => {
              const save = savingsPct(p, plans);
              const monthly = perMonth(p);
              const isCurrent = active && p.id === me?.planId;
              return (
                <article key={p.id} className={`pm-plan ${p.highlight ? "is-pick" : ""}`}>
                  {p.highlight && <span className="pm-plan__ribbon">Best value</span>}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-xl">{p.name}</h3>
                    {save > 0 && <span className="pm-save">Save {save}%</span>}
                  </div>
                  <p className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-[2.6rem] leading-none tracking-[-0.02em]">{naira(p.amount)}</span>
                    <span className="text-sm opacity-70">/ {lengthLabel(p.days)}</span>
                  </p>
                  <p className="mt-2 h-5 text-xs opacity-70">{p.days > 31 ? `That's about ${naira(monthly)} a month` : `${p.days} days of Premium`}</p>
                  <div className="pm-plan__rule" />
                  <ul className="flex-1 space-y-2.5 text-sm">
                    {(p.perks || []).filter(Boolean).map((x) => (
                      <li key={x} className="flex gap-2.5"><span className="pm-tick"><Check size={12} strokeWidth={3} aria-hidden="true" /></span> {x}</li>
                    ))}
                  </ul>
                  <button type="button" className={`pm-btn mt-7 w-full ${p.highlight ? "pm-btn--lemon" : "pm-btn--ink"}`} disabled={!!busy || !data.ready} onClick={() => pay(p)}>
                    {busy === p.id ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Opening Paystack…</> : isCurrent ? `Add ${lengthLabel(p.days)} · ${naira(p.amount)}` : `Get ${p.name} · ${naira(p.amount)}`}
                  </button>
                </article>
              );
            })}
          </div>
        )}
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
          <ShieldCheck size={14} aria-hidden="true" /> {page.note || "Payments are processed securely by Paystack. Card, bank transfer and USSD accepted."}
        </p>
      </section>

      {/* ── What's included ──────────────────────────────── */}
      {features.length > 0 && (
        <section className="mt-14" aria-labelledby="pm-incl">
          <p className="pm-eyebrow">Included</p>
          <h2 id="pm-incl" className="mt-1 font-display text-2xl text-ink">What Premium unlocks</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = FEATURE_ICON[f.key] || Crown;
              return (
                <div key={f.key} className="pm-feature">
                  <span className="pm-feature__icon"><Icon size={18} aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{f.label}</p>
                    <p className="mt-0.5 text-sm leading-snug text-ink-muted">{f.hint}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────── */}
      {page.faq?.filter((f) => f.q).length > 0 && (
        <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.6fr]" aria-labelledby="pm-faq">
          <div>
            <p className="pm-eyebrow">Questions</p>
            <h2 id="pm-faq" className="mt-1 font-display text-2xl text-ink">Before you pay</h2>
            {page.supportEmail && (
              <a href={`mailto:${page.supportEmail}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet hover:underline">
                <Mail size={15} aria-hidden="true" /> {page.supportEmail}
              </a>
            )}
          </div>
          <div className="pm-faq">
            {page.faq.filter((f) => f.q).map((f) => (
              <details key={f.q}>
                <summary>{f.q}<ChevronDown size={18} aria-hidden="true" /></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}
      {!page.faq?.length && page.supportEmail && <p className="mt-10 text-center text-xs text-ink-muted">Payment problem? Email {page.supportEmail}.</p>}
    </div>
  );
}
