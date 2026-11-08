import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Save, Wallet, Receipt, Crown, PlugZap, CheckCircle2, AlertCircle, Search, Star, Eye, EyeOff,
  UserPlus, Loader2, RotateCcw, GripVertical,
} from "lucide-react";
import { billingApi, lengthLabel, naira, perMonth } from "../lib/billing";
import "../billing.css";

const blankPlan = () => ({ id: "", name: "", amount: 1000, days: 30, perks: ["All premium features"], active: false, highlight: false });
const TABS = [
  { id: "plans", label: "Plans" },
  { id: "features", label: "Free or paid" },
  { id: "page", label: "Upgrade page" },
  { id: "payments", label: "Payments" },
];

export default function AdminBilling() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("plans");

  const load = () => billingApi.admin()
    .then((d) => { setData(d); setForm(structuredClone(d.billing)); setSaved(JSON.stringify(d.billing)); })
    .catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, []);

  const dirty = form && JSON.stringify(form) !== saved;
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!form) {
    return (
      <div className="pm space-y-4 p-4 sm:p-6">
        {msg ? <p className="pm-note pm-note--err"><AlertCircle size={16} /> {msg.text}</p> : <><div className="pm-skel h-10 w-64" /><div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="pm-skel h-24" />)}</div><div className="pm-skel h-96" /></>}
      </div>
    );
  }

  const setPlan = (i, patch) => setForm((f) => ({ ...f, plans: f.plans.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const setPage = (patch) => setForm((f) => ({ ...f, page: { ...f.page, ...patch } }));
  const togglePremium = (key) => setForm((f) => ({ ...f, premium: { ...f.premium, [key]: !f.premium[key] } }));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const clean = { ...form, plans: form.plans.map((p) => ({ ...p, perks: p.perks.map((x) => x.trim()).filter(Boolean) })) };
      const { billing } = await billingApi.save(clean);
      setForm(structuredClone(billing));
      setSaved(JSON.stringify(billing));
      setMsg({ ok: true, text: "Saved. Students see the change straight away." });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  }

  const paidCount = Object.values(form.premium).filter(Boolean).length;
  const onSale = form.plans.filter((p) => p.active).length;
  const revenue = data.stats.revenueNaira ?? (data.stats.revenueKobo != null ? data.stats.revenueKobo / 100 : 0);

  return (
    <div className="pm space-y-6 p-4 pb-28 sm:p-6 sm:pb-28">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="pm-eyebrow">Admin</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Billing &amp; premium</h1>
          <p className="mt-1 text-sm text-ink-muted">Set your plans, choose which features are paid, and edit what students see.</p>
        </div>
        <a href="/dashboard/upgrade" target="_blank" rel="noreferrer" className="pm-btn pm-btn--line"><Eye size={15} /> View upgrade page</a>
      </header>

      {msg && <p className={`pm-note ${msg.ok ? "pm-note--ok" : "pm-note--err"}`} role="status">{msg.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {msg.text}</p>}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Wallet} label="Revenue" value={naira(revenue)} hint="All confirmed payments" />
        <Kpi icon={Receipt} label="Paid payments" value={data.stats.paidCount} hint="Successful checkouts" />
        <Kpi icon={Crown} label="Active premium" value={data.stats.activeSubs} hint="Plans running now" />
        <Kpi icon={PlugZap} label="Paystack" value={data.paystackReady ? "Connected" : "Not connected"} hint={data.paystackReady ? "Checkout is live" : "Set PAYSTACK_SECRET_KEY"} tone={data.paystackReady ? "ok" : "warn"} />
      </section>

      {!data.paystackReady && (
        <div className="pm-note pm-note--warn items-start">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>Students can't pay yet. Add <code>PAYSTACK_SECRET_KEY</code> to the API environment, then set the Paystack webhook to <code>https://&lt;your-api-domain&gt;{data.webhookUrl}</code>.</span>
        </div>
      )}

      {/* Tabs */}
      <nav className="pm-tabs" aria-label="Billing sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={tab === t.id ? "on" : ""} aria-pressed={tab === t.id}>
            {t.label}
            {t.id === "plans" && <span>{onSale}/{form.plans.length}</span>}
            {t.id === "features" && <span>{paidCount} paid</span>}
            {t.id === "payments" && <span>{data.payments.length}</span>}
          </button>
        ))}
      </nav>

      {tab === "plans" && (
        <section className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {form.plans.map((p, i) => (
              <article key={i} className={`pm-card ${p.active ? "" : "is-muted"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <GripVertical size={16} className="text-ink-muted/50" aria-hidden="true" />
                    <div>
                      <p className="font-display text-xl text-ink">{p.name || "New plan"}</p>
                      <p className="text-xs text-ink-muted">{naira(p.amount)} / {lengthLabel(p.days)}{p.days > 31 ? ` · about ${naira(perMonth(p))} a month` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.highlight && <span className="pm-badge pm-badge--lemon"><Star size={11} /> Best value</span>}
                    <span className={`pm-badge ${p.active ? "pm-badge--ok" : ""}`}>{p.active ? "On sale" : "Hidden"}</span>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Field label="Plan name"><input className="pm-input" value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} placeholder="Monthly" /></Field>
                  <Field label="Short id" hint="Letters, numbers, dashes"><input className="pm-input font-mono" value={p.id} onChange={(e) => setPlan(i, { id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="monthly" /></Field>
                  <Field label="Price"><div className="pm-input-group"><span>₦</span><input className="pm-input" type="number" min="100" step="50" value={p.amount} onChange={(e) => setPlan(i, { amount: Number(e.target.value) })} /></div></Field>
                  <Field label="Length"><div className="pm-input-group"><input className="pm-input" type="number" min="1" max="730" value={p.days} onChange={(e) => setPlan(i, { days: Number(e.target.value) })} /><span>days</span></div></Field>
                </div>
                <Field label="Perks" hint="One per line, shown with a tick" className="mt-3">
                  <textarea className="pm-input" rows={3} value={p.perks.join("\n")} onChange={(e) => setPlan(i, { perks: e.target.value.split("\n") })} />
                </Field>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-light pt-4">
                  <Switch checked={p.active} onChange={(v) => setPlan(i, { active: v })} label="On sale" />
                  <Switch checked={!!p.highlight} onChange={(v) => setForm((f) => ({ ...f, plans: f.plans.map((x, j) => ({ ...x, highlight: j === i ? v : v ? false : x.highlight })) }))} label="Best value" />
                  <button type="button" className="pm-btn pm-btn--ghost ml-auto text-status-danger" onClick={() => window.confirm(`Remove the ${p.name || "new"} plan?`) && setForm((f) => ({ ...f, plans: f.plans.filter((_, j) => j !== i) }))}><Trash2 size={14} /> Remove</button>
                </div>
              </article>
            ))}
            <button type="button" className="pm-add" onClick={() => setForm((f) => ({ ...f, plans: [...f.plans, blankPlan()] }))} disabled={form.plans.length >= 8}>
              <Plus size={20} /> <span>Add a plan</span><small>Up to 8 plans</small>
            </button>
          </div>
          <GrantPremium plans={form.plans} />
        </section>
      )}

      {tab === "features" && <FeatureToggles features={data.features} premium={form.premium} onToggle={togglePremium} />}

      {tab === "page" && (
        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="pm-card space-y-3">
            <h2 className="font-display text-xl text-ink">Words on the upgrade page</h2>
            <Field label="Headline"><input className="pm-input" value={form.page.headline} onChange={(e) => setPage({ headline: e.target.value })} /></Field>
            <Field label="Subheadline"><input className="pm-input" value={form.page.subheadline} onChange={(e) => setPage({ subheadline: e.target.value })} /></Field>
            <Field label="Note under the plans"><textarea className="pm-input" rows={2} value={form.page.note} onChange={(e) => setPage({ note: e.target.value })} /></Field>
            <Field label="Support email"><input className="pm-input" type="email" value={form.page.supportEmail} onChange={(e) => setPage({ supportEmail: e.target.value })} placeholder="support@academicall.site" /></Field>
            <div className="border-t border-border-light pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">FAQ</h3>
                <button type="button" className="pm-btn pm-btn--ghost" onClick={() => setPage({ faq: [...form.page.faq, { q: "", a: "" }] })}><Plus size={14} /> Add question</button>
              </div>
              <div className="mt-3 space-y-3">
                {form.page.faq.map((f, i) => (
                  <div key={i} className="rounded-xl border border-border-light bg-paper p-3">
                    <div className="flex gap-2">
                      <input className="pm-input font-semibold" value={f.q} placeholder="Question" onChange={(e) => setPage({ faq: form.page.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
                      <button type="button" className="pm-icon-btn" aria-label="Remove question" onClick={() => setPage({ faq: form.page.faq.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                    </div>
                    <textarea className="pm-input mt-2" rows={2} value={f.a} placeholder="Answer" onChange={(e) => setPage({ faq: form.page.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:sticky lg:top-20 lg:self-start">
            <p className="pm-eyebrow mb-2">Live preview</p>
            <div className="pm-hero !mt-0 !min-h-0 !p-7">
              <div className="relative z-[1]">
                <span className="pm-chip"><Crown size={13} /> Academicall Premium</span>
                <p className="mt-4 font-display text-[1.9rem] leading-[1.08]">{form.page.headline || "Headline"}</p>
                <p className="mt-2 text-sm text-white/75">{form.page.subheadline || "Subheadline"}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-muted">{form.page.note}</p>
          </div>
        </section>
      )}

      {tab === "payments" && <Payments payments={data.payments} />}

      {/* Save bar */}
      <div className={`pm-savebar ${dirty ? "is-on" : ""}`} role="region" aria-label="Unsaved changes">
        <p className="text-sm"><b>Unsaved changes.</b> <span className="hidden text-white/70 sm:inline">Students won't see them until you save.</span></p>
        <div className="flex gap-2">
          <button type="button" className="pm-btn pm-btn--glass" onClick={() => setForm(JSON.parse(saved))} disabled={saving}><RotateCcw size={14} /> Discard</button>
          <button type="button" className="pm-btn pm-btn--lemon" onClick={save} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="pm-kpi">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className={`pm-kpi__icon ${tone === "ok" ? "is-ok" : tone === "warn" ? "is-warn" : ""}`}><Icon size={15} aria-hidden="true" /></span>
      </div>
      <p className="mt-3 font-display text-[1.7rem] leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
    </div>
  );
}

function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-baseline justify-between text-xs font-medium text-ink">{label}{hint && <small className="font-normal text-ink-muted">{hint}</small>}</span>
      {children}
    </label>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`pm-switch ${checked ? "is-on" : ""}`}>
      <span aria-hidden="true" /> {label}
    </button>
  );
}

function FeatureToggles({ features, premium, onToggle }) {
  const groups = [...new Set(features.filter((f) => f.key !== "upgrade").map((f) => f.group))];
  return (
    <section className="space-y-4">
      <p className="text-sm text-ink-muted">Switched-on features need Premium. Everything else stays free. Staff always have full access.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <div key={g} className="pm-card !p-0">
            <p className="pm-eyebrow border-b border-border-light px-5 py-3">{g}</p>
            <ul>
              {features.filter((f) => f.group === g && f.key !== "upgrade").map((f) => (
                <li key={f.key} className="flex items-center gap-4 border-b border-border-light px-5 py-3.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{f.label}</p>
                    <p className="text-xs text-ink-muted">{f.hint}</p>
                  </div>
                  <span className={`pm-badge ${premium[f.key] ? "pm-badge--lemon" : ""}`}>{premium[f.key] ? <><Crown size={11} /> Paid</> : "Free"}</span>
                  <button type="button" role="switch" aria-checked={!!premium[f.key]} aria-label={`${f.label} is paid`} onClick={() => onToggle(f.key)} className={`pm-switch pm-switch--bare ${premium[f.key] ? "is-on" : ""}`}><span /></button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const STATUS_TONE = { success: "pm-badge--ok", pending: "pm-badge--warn", failed: "pm-badge--err", abandoned: "" };

function Payments({ payments }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const list = useMemo(() => payments.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    const s = q.trim().toLowerCase();
    return !s || [p.user?.name, p.user?.email, p.reference, p.plan].some((v) => String(v || "").toLowerCase().includes(s));
  }), [payments, q, status]);
  return (
    <section className="pm-card !p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-light p-4">
        <label className="pm-search flex-1"><Search size={15} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, reference" aria-label="Search payments" /></label>
        <div className="pm-seg">
          {["all", "success", "pending", "failed"].map((s) => <button key={s} type="button" className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}</button>)}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="pm-table">
          <thead><tr><th>Student</th><th>Plan</th><th className="text-right">Amount</th><th>Status</th><th>Date</th><th>Reference</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td><p className="font-semibold text-ink">{p.user?.name || "Unknown"}</p><p className="text-xs text-ink-muted">{p.user?.email || "—"}</p></td>
                <td className="capitalize">{p.plan || "—"}</td>
                <td className="text-right font-semibold tabular-nums">{p.amount != null ? naira(p.amount) : "—"}</td>
                <td><span className={`pm-badge ${STATUS_TONE[p.status] || ""}`}>{p.status || "—"}</span></td>
                <td className="whitespace-nowrap text-ink-muted">{new Date(p.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="font-mono text-xs text-ink-muted">{p.reference || "manual"}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-ink-muted">{payments.length ? "No payments match." : "No payments yet. They'll appear here as students check out."}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GrantPremium({ plans }) {
  const [userId, setUserId] = useState("");
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState(null);
  async function run(revoke) {
    if (!userId.trim()) return;
    if (revoke && !window.confirm("Remove premium from this account now?")) return;
    setBusy(revoke ? "revoke" : "grant"); setNote(null);
    try {
      await billingApi.grant(userId.trim(), revoke ? { revoke: true } : { planId });
      setNote({ ok: true, text: revoke ? "Premium removed." : "Premium granted." });
    } catch (e) { setNote({ ok: false, text: e.message }); } finally { setBusy(""); }
  }
  return (
    <div className="pm-card">
      <div className="flex items-center gap-2"><UserPlus size={17} className="text-violet" /><h2 className="font-display text-lg text-ink">Give or remove premium by hand</h2></div>
      <p className="mt-1 text-sm text-ink-muted">For refunds, scholarships or a payment that came in outside Paystack. Paste the user's ID from Users.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1.4fr_1fr_auto_auto]">
        <input className="pm-input font-mono" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" aria-label="User ID" />
        <select className="pm-input" value={planId} onChange={(e) => setPlanId(e.target.value)} aria-label="Plan">
          {plans.map((p) => <option key={p.id || p.name} value={p.id}>{p.name || p.id} ({lengthLabel(p.days)})</option>)}
        </select>
        <button type="button" className="pm-btn pm-btn--ink" disabled={!!busy || !userId} onClick={() => run(false)}>{busy === "grant" ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />} Grant</button>
        <button type="button" className="pm-btn pm-btn--line" disabled={!!busy || !userId} onClick={() => run(true)}>{busy === "revoke" ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />} Revoke</button>
      </div>
      {note && <p className={`pm-note mt-3 ${note.ok ? "pm-note--ok" : "pm-note--err"}`}>{note.text}</p>}
    </div>
  );
}
