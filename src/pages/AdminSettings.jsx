import { useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Settings,
  Save,
  LogOut,
  Sparkles,
  Wallet,
  Shield,
  Link2,
  Building2,
} from "lucide-react";
import { db } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { settingsApi } from "../lib/api";

const fieldClass =
  "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none";

const DEFAULTS = {
  appName: "Academicall",
  supportEmail: "",
  supportWhatsapp: "",
  aiAssistEnabled: true,
  aiAutoTitle: true,
  aiSuggestTags: true,
  maintenanceMode: false,
  announceBanner: "",
  defaultPlanNote: "Pay with the same email as your account so Pro activates automatically.",
};

export default function AdminSettings() {
  const navigate = useNavigate();
  const { logout, authMode } = useAuth();
  const { fontScale, setFontScale, fontScales } = useTheme();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (authMode === "api") {
      let alive = true;
      settingsApi.get("general").then(({ value }) => {
        if (!alive) return;
        setForm(value ? { ...DEFAULTS, ...value } : { ...DEFAULTS });
      }).catch(() => alive && setForm({ ...DEFAULTS }));
      return () => { alive = false; };
    }
    const unsub = onSnapshot(
      doc(db, "appSettings", "general"),
      (snap) => {
        setForm(snap.exists() ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS });
      },
      () => setForm({ ...DEFAULTS })
    );
    return unsub;
  }, [authMode]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMsg("");
    try {
      const payload = {
          appName: form.appName?.trim() || "Academicall",
          supportEmail: form.supportEmail?.trim() || "",
          supportWhatsapp: form.supportWhatsapp?.trim() || "",
          aiAssistEnabled: !!form.aiAssistEnabled,
          aiAutoTitle: !!form.aiAutoTitle,
          aiSuggestTags: !!form.aiSuggestTags,
          maintenanceMode: !!form.maintenanceMode,
          announceBanner: form.announceBanner?.trim() || "",
          defaultPlanNote: form.defaultPlanNote?.trim() || "",
        };
      if (authMode === "api") await settingsApi.update("general", payload);
      else await setDoc(
        doc(db, "appSettings", "general"),
        { ...payload, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setMsg("Settings saved.");
    } catch (err) {
      setMsg(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  if (!form) {
    return <div className="text-sm text-text-muted">Loading settings…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Admin Settings</h1>
          <p className="text-sm text-text-secondary">
            Platform, AI document helpers, announcements, and account.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg border border-status-danger/40 px-4 py-2 text-sm font-medium text-status-danger hover:bg-status-danger/10"
        >
          <LogOut size={15} />
          Log out
        </button>
      </div>

      <form onSubmit={save} className="space-y-6">
        {/* Platform */}
        <section className="space-y-4 rounded-xl border border-border-subtle bg-bg-panel p-5">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Platform</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-text-muted">App name</label>
              <input
                value={form.appName}
                onChange={(e) => set("appName", e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Support email</label>
              <input
                value={form.supportEmail}
                onChange={(e) => set("supportEmail", e.target.value)}
                className={fieldClass}
                placeholder="support@..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Support WhatsApp</label>
              <input
                value={form.supportWhatsapp}
                onChange={(e) => set("supportWhatsapp", e.target.value)}
                className={fieldClass}
                placeholder="+234..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-text-muted">Site banner (optional)</label>
              <input
                value={form.announceBanner}
                onChange={(e) => set("announceBanner", e.target.value)}
                className={fieldClass}
                placeholder="Shown to students under the header"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary sm:col-span-2">
              <input
                type="checkbox"
                checked={!!form.maintenanceMode}
                onChange={(e) => set("maintenanceMode", e.target.checked)}
                className="rounded border-border-subtle"
              />
              Maintenance mode (show banner only — does not block login yet)
            </label>
          </div>
        </section>

        {/* AI document features */}
        <section className="space-y-4 rounded-xl border border-border-subtle bg-bg-panel p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">AI · Document upload</h2>
          </div>
          <p className="text-xs text-text-muted">
            Helpers on Admin → Documents: auto title from file name, tags from course, and smart
            description stubs. No external API key required for these.
          </p>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={!!form.aiAssistEnabled}
              onChange={(e) => set("aiAssistEnabled", e.target.checked)}
            />
            Enable AI assist on document upload
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={!!form.aiAutoTitle}
              onChange={(e) => set("aiAutoTitle", e.target.checked)}
              disabled={!form.aiAssistEnabled}
            />
            Auto-generate title from PDF file name
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={!!form.aiSuggestTags}
              onChange={(e) => set("aiSuggestTags", e.target.checked)}
              disabled={!form.aiAssistEnabled}
            />
            Suggest tags (course code, level, faculty)
          </label>
        </section>

        {/* Payments shortcut */}
        <section className="space-y-3 rounded-xl border border-border-subtle bg-bg-panel p-5">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Payments</h2>
          </div>
          <p className="text-sm text-text-secondary">
            Plan prices and Paystack links are managed on the Payments page.
          </p>
          <button
            type="button"
            onClick={() => navigate("/admin/payments")}
            className="flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-elevated"
          >
            <Link2 size={15} /> Open Payments & Subscription
          </button>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Note shown near checkout</label>
            <textarea
              value={form.defaultPlanNote}
              onChange={(e) => set("defaultPlanNote", e.target.value)}
              rows={2}
              className={fieldClass}
            />
          </div>
        </section>

        {/* Display / text size */}
        <section className="space-y-3 rounded-xl border border-border-subtle bg-bg-panel p-5">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Display size</h2>
          </div>
          <p className="text-sm text-text-secondary">
            Adjust text size for easier reading on this device. Applies across the admin app.
          </p>
          <div className="flex flex-wrap gap-2">
            {fontScales.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFontScale(s.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  fontScale === s.id
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border-subtle text-text-secondary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Security */}
        <section className="space-y-3 rounded-xl border border-border-subtle bg-bg-panel p-5">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Account</h2>
          </div>
          <p className="text-sm text-text-secondary">
            Sign out of this admin session on this device.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg bg-status-danger/15 px-4 py-2.5 text-sm font-semibold text-status-danger hover:bg-status-danger/25"
          >
            <LogOut size={15} /> Log out of admin
          </button>
        </section>

        {msg && <p className="text-sm text-accent">{msg}</p>}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
        >
          <Save size={15} />
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
