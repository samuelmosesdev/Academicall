import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { Wallet, Link2, Crown, Search, UserMinus, Save, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { paymentsApi, settingsApi, usersApi } from "../lib/api";
import { usePaymentSettings } from "../hooks/usePaymentSettings";
import { DEFAULT_PLANS, isPro } from "../lib/subscription";

const fieldClass =
  "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none";

export default function AdminPayments() {
  const { settings, loading: settingsLoading } = usePaymentSettings();
  const { authMode } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [students, setStudents] = useState([]);
  const [claims, setClaims] = useState([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!settingsLoading) {
      setForm({
        headline: settings.headline || "",
        subheadline: settings.subheadline || "",
        plans: {
          weekly: {
            url: settings.plans?.weekly?.url || "",
            amountLabel: settings.plans?.weekly?.amountLabel || "₦500",
          },
          monthly: {
            url: settings.plans?.monthly?.url || "",
            amountLabel: settings.plans?.monthly?.amountLabel || "₦1,500",
          },
          annual: {
            url: settings.plans?.annual?.url || "https://paystack.shop/pay/5o79vdpr6a",
            amountLabel: settings.plans?.annual?.amountLabel || "₦4,000",
          },
        },
      });
    }
  }, [settings, settingsLoading]);

  useEffect(() => {
    if (authMode === "api") {
      usersApi.list().then(({ users: list = [] }) => setStudents(list.filter((item) => item.role === "user"))).catch(() => setStudents([]));
      return;
    }
    const q = query(collection(db, "users"), where("role", "==", "user"));
    return onSnapshot(
      q,
      (snap) => setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setStudents([])
    );
  }, [authMode]);

  useEffect(() => {
    if (authMode === "api") {
      paymentsApi.listClaims().then(({ claims: list = [] }) => setClaims(list)).catch(() => setClaims([]));
      return;
    }
    return onSnapshot(
      collection(db, "paymentClaims"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setClaims(list.slice(0, 40));
      },
      () => setClaims([])
    );
  }, [authMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((u) =>
      [u.name, u.email, u.uniqueId, u.department]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [students, search]);

  const proCount = students.filter((u) => isPro(u)).length;
  const pendingClaims = claims.filter((c) => c.status === "awaiting_review");

  async function saveSettings(e) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMsg("");
    try {
      await settingsApi.update("payments", {
          headline: form.headline?.trim() || "",
          subheadline: form.subheadline?.trim() || "",
          plans: {
            weekly: {
              url: form.plans.weekly.url?.trim() || "",
              amountLabel: form.plans.weekly.amountLabel || "₦500",
              enabled: true,
            },
            monthly: {
              url: form.plans.monthly.url?.trim() || "",
              amountLabel: form.plans.monthly.amountLabel || "₦1,500",
              enabled: true,
            },
            annual: {
              url: form.plans.annual.url?.trim() || "https://paystack.shop/pay/5o79vdpr6a",
              amountLabel: form.plans.annual.amountLabel || "₦4,000",
              enabled: true,
            },
          },
          priceLabel: form.plans.annual.amountLabel || "₦4,000 / year",
          priceNote: "Paystack checkout · activate Pro after payment",
      });
      setMsg("Payment settings saved.");
    } catch (err) {
      setMsg(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function setPlan(user, plan) {
    setBusyId(user.id);
    try {
      await usersApi.update(user.id, { plan });
    } catch (err) {
      alert(err.message || "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function approveClaim(claim) {
    setBusyId(claim.id);
    try {
      await usersApi.update(claim.userId, { plan: "pro" });
      await paymentsApi.approveClaim(claim.id);
    } catch (err) {
      alert(err.message || "Could not activate.");
    } finally {
      setBusyId(null);
    }
  }

  function setPlanField(planId, key, value) {
    setForm((prev) => ({
      ...prev,
      plans: {
        ...prev.plans,
        [planId]: { ...prev.plans[planId], [key]: value },
      },
    }));
  }

  if (!form) {
    return <div className="text-sm text-text-muted">Loading…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Payments & Subscription</h1>
        <p className="text-sm text-text-secondary">
          Manage Paystack plan links. Annual is live at ₦4,000. Set Weekly / Monthly when ready.
          Only admins can activate Pro.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-text-primary">{students.length}</div>
          <div className="text-xs text-text-muted">Students</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-accent">{proCount}</div>
          <div className="text-xs text-text-muted">Pro members</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-text-primary">{students.length - proCount}</div>
          <div className="text-xs text-text-muted">Free</div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-panel p-4">
          <div className="text-2xl font-bold text-status-warning">{pendingClaims.length}</div>
          <div className="text-xs text-text-muted">Awaiting activation</div>
        </div>
      </div>

      <form onSubmit={saveSettings} className="space-y-4 rounded-xl border border-border-subtle bg-bg-panel p-5">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Plan links (Paystack)</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-text-muted">Upgrade headline</label>
            <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} className={fieldClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-text-muted">Subheadline</label>
            <textarea value={form.subheadline} onChange={(e) => setForm({ ...form, subheadline: e.target.value })} rows={2} className={fieldClass} />
          </div>
        </div>

        <div className="space-y-3">
          {DEFAULT_PLANS.map((p) => (
            <div key={p.id} className="rounded-xl border border-border-subtle bg-bg-panel-alt p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">
                  {p.name}{" "}
                  <span className="font-normal text-text-muted">
                    ({form.plans[p.id]?.amountLabel || p.amountLabel})
                  </span>
                </p>
                {p.id === "annual" && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">LIVE</span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-text-muted">Display price</label>
                  <input
                    value={form.plans[p.id]?.amountLabel || ""}
                    onChange={(e) => setPlanField(p.id, "amountLabel", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 flex items-center gap-1 text-[11px] text-text-muted">
                    <Link2 size={11} /> Paystack URL
                  </label>
                  <input
                    value={form.plans[p.id]?.url || ""}
                    onChange={(e) => setPlanField(p.id, "url", e.target.value)}
                    className={fieldClass}
                    placeholder={p.id === "annual" ? "https://paystack.shop/pay/5o79vdpr6a" : "Paste when ready"}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {msg && <p className="text-sm text-accent">{msg}</p>}

        <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60">
          <Save size={15} />
          {saving ? "Saving…" : "Save payment settings"}
        </button>
      </form>

      {pendingClaims.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Payment notices (activate Pro)</h2>
          <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-bg-panel">
            {pendingClaims.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{c.name || c.email || c.userId}</p>
                  <p className="text-xs text-text-muted">
                    {c.planName} · {c.amountLabel} · {c.email}
                  </p>
                </div>
                <button type="button" disabled={busyId === c.id} onClick={() => approveClaim(c)} className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-bg-app hover:bg-accent-strong">
                  <CheckCircle2 size={13} /> Activate Pro
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-primary">All students</h2>
          <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 sm:max-w-xs">
            <Search size={15} className="text-text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students…" className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none" />
          </div>
        </div>
        <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-bg-panel">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-muted">No students found.</div>
          )}
          {filtered.map((u) => {
            const pro = isPro(u);
            return (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{u.name || "—"}</p>
                  <p className="text-xs text-text-muted">
                    {u.email}
                    {u.department ? ` · ${u.department}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pro ? "bg-accent-soft text-accent" : "bg-bg-elevated text-text-muted"}`}>
                    {pro ? "Pro" : "Free"}
                  </span>
                  {pro ? (
                    <button type="button" disabled={busyId === u.id} onClick={() => setPlan(u, "free")} className="flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-elevated">
                      <UserMinus size={13} /> Set Free
                    </button>
                  ) : (
                    <button type="button" disabled={busyId === u.id} onClick={() => setPlan(u, "pro")} className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-bg-app hover:bg-accent-strong">
                      <Crown size={13} /> Make Pro
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
