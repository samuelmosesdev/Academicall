import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  UserCog,
  Ban,
  CheckCircle2,
  Copy,
  Mail,
  KeyRound,
  Shield,
  ExternalLink,
} from "lucide-react";
import ConfirmModal from "../components/ConfirmModal";
import { ROLE_LABELS } from "../lib/roles";
import { isAdmin } from "../lib/roles";
import { logActivity } from "../lib/activityLog";
import { useAuth } from "../context/AuthContext";
import { usersApi } from "../lib/api";

const AGENT_DOMAIN = "academicall.site";

const fieldClass =
  "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none";

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function AdminAgents() {
  const { profile, user, authMode } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [role, setRole] = useState("agent");
  const [password, setPassword] = useState(() => generateTempPassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdCreds, setCreatedCreds] = useState(null);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (authMode === "api") {
      usersApi.list().then(({ users = [] }) => setAgents(users.filter((item) => item.role === "agent" || item.role === "alphaAgent"))).catch(() => setAgents([]));
      return;
    }
    const q = query(
      collection(db, "users"),
      where("role", "in", ["agent", "alphaAgent"])
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAgents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [authMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = agents;
    if (roleFilter === "alpha") list = agents.filter((a) => a.role === "alphaAgent");
    if (roleFilter === "beta") list = agents.filter((a) => a.role === "agent");
    if (!q) return list;
    return list.filter((a) =>
      [a.name, a.email].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
    );
  }, [agents, search, roleFilter]);

  const fullEmail = useMemo(() => {
    const local = localPart.trim().toLowerCase().replace(/[^a-z0-9._+-]/g, "");
    if (!local) return "";
    return `${local}@${AGENT_DOMAIN}`;
  }, [localPart]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setCreatedCreds(null);
    if (!isAdmin(profile)) {
      return setError("Only admins can create agent accounts.");
    }
    if (!fullEmail || !password || password.length < 6) {
      return setError("Local part and password (min 6 characters) are required.");
    }

    setSaving(true);
    try {
      const { user: createdUser } = await usersApi.createAgent({
        email: fullEmail,
        password,
        name: name.trim() || localPart.trim() || fullEmail.split("@")[0],
        role: role === "alphaAgent" ? "alphaAgent" : "agent",
      });

      await logActivity({
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "agent.create",
        targetUid: createdUser.id,
        targetName: name.trim() || fullEmail,
        meta: { email: fullEmail, role },
      });

      setCreatedCreds({
        email: fullEmail,
        password,
        name: name.trim() || localPart.trim(),
      });
      setSuccess(
        `Agent created: ${fullEmail}. Share the temporary password, then have them sign in and change it.`
      );
      setName("");
      setLocalPart("");
      setPassword(generateTempPassword());
      setRole("agent");
      setShowForm(false);
    } catch (err) {
      const msg = err?.code === "auth/email-already-in-use"
        ? "That email is already registered in the app. Use a different local part or remove the old account."
        : err.message || "Failed to create agent.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSuspend(agent) {
    try {
      await usersApi.update(agent.id, {
        status: agent.status === "suspended" ? "active" : "suspended",
      });
    } catch (err) {
      alert(err.message || "Could not update status.");
    }
  }

  async function forcePasswordReset(agent) {
    try {
      await usersApi.update(agent.id, {
        mustChangePassword: true,
      });
      setSuccess(
        `${agent.name || agent.email} must change password on next login. Reset their Firebase password in Console if they lost access.`
      );
    } catch (err) {
      setError(err.message || "Could not flag password change.");
    }
  }

  async function runPending() {
    if (!pending) return;
    const { type, agent } = pending;
    try {
      if (type === "promote") {
        await usersApi.update(agent.id, { role: "alphaAgent" });
        await logActivity({
          actorUid: user.uid,
          actorName: profile?.name || user.email,
          action: "role.change",
          targetUid: agent.id,
          targetName: agent.name || agent.email,
          meta: { from: agent.role, to: "alphaAgent" },
        });
        setSuccess("Promoted to Alpha Agent");
      }
      if (type === "demote") {
        await usersApi.update(agent.id, { role: "agent" });
        await logActivity({
          actorUid: user.uid,
          actorName: profile?.name || user.email,
          action: "role.change",
          targetUid: agent.id,
          targetName: agent.name || agent.email,
          meta: { from: agent.role, to: "agent" },
        });
        setSuccess("Demoted to Agent");
      }
      setPending(null);
    } catch (e) {
      setPending(null);
      setError(e.message || "Action failed");
    }
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text).then(
      () => setSuccess("Copied to clipboard"),
      () => setError("Could not copy")
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Agent management</h1>
          <p className="text-sm text-text-secondary">
            Create agents on <span className="font-medium text-text-primary">@{AGENT_DOMAIN}</span>,
            promote, suspend, and require password changes.
          </p>
        </div>
        {isAdmin(profile) && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setError("");
              setSuccess("");
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-bg-app"
          >
            <Plus size={16} /> New agent
          </button>
        )}
      </div>

      {/* Hostinger mailbox note */}
      <div className="rounded-2xl border border-border-subtle bg-bg-panel p-4 text-sm text-text-secondary">
        <p className="flex items-start gap-2 font-medium text-text-primary">
          <Mail size={16} className="mt-0.5 shrink-0 text-accent" />
          Two steps for a full agent email
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs sm:text-sm">
          <li>
            In <strong>Hostinger</strong> → Emails → create mailbox{" "}
            <code className="rounded bg-bg-panel-alt px-1">name@{AGENT_DOMAIN}</code>{" "}
            (so they can receive real mail at that address).
          </li>
          <li>
            Here, create the same address as an <strong>app login</strong>. They sign in at Academicall
            with that email + temporary password, then must change the password.
          </li>
        </ol>
        <a
          href="https://hpanel.hostinger.com/"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          Open Hostinger panel <ExternalLink size={12} />
        </a>
      </div>

      {error && (
        <p className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent">
          {success}
        </p>
      )}

      {createdCreds && (
        <div className="rounded-2xl border border-accent/40 bg-accent-soft/50 p-4">
          <p className="text-sm font-semibold text-text-primary">
            Share these credentials once (then require password change)
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted">Email</span>
              <code className="rounded bg-bg-panel px-2 py-1 text-text-primary">
                {createdCreds.email}
              </code>
              <button
                type="button"
                onClick={() => copyText(createdCreds.email)}
                className="rounded p-1 text-text-muted hover:text-accent"
              >
                <Copy size={14} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted">Temp password</span>
              <code className="rounded bg-bg-panel px-2 py-1 text-text-primary">
                {createdCreds.password}
              </code>
              <button
                type="button"
                onClick={() => copyText(createdCreds.password)}
                className="rounded p-1 text-text-muted hover:text-accent"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && isAdmin(profile) && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-2xl border border-border-subtle bg-bg-panel p-5"
        >
          <h2 className="text-sm font-semibold text-text-primary">Create agent account</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Display name</label>
              <input
                className={fieldClass}
                placeholder="Deborah"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Role</label>
              <select
                className={fieldClass}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="agent">Agent (Beta)</option>
                <option value="alphaAgent">Alpha Agent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              Work email (domain locked)
            </label>
            <div className="flex items-center gap-2">
              <input
                className={fieldClass}
                placeholder="deborah"
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                required
                autoComplete="off"
              />
              <span className="shrink-0 text-sm font-medium text-text-secondary">
                @{AGENT_DOMAIN}
              </span>
            </div>
            {fullEmail && (
              <p className="mt-1 text-xs text-text-muted">
                Login email: <span className="font-medium text-text-primary">{fullEmail}</span>
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Temporary password</label>
            <div className="flex gap-2">
              <input
                className={fieldClass}
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setPassword(generateTempPassword())}
                className="shrink-0 rounded-lg border border-border-subtle px-3 text-xs font-medium text-text-secondary hover:bg-bg-panel-alt"
              >
                Regenerate
              </button>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              Agent will be forced to change this password on first login.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-border-subtle px-4 py-2 text-sm text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-bg-app disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create agent"}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            className={`${fieldClass} pl-9`}
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={`${fieldClass} w-auto`}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All roles</option>
          <option value="alpha">Alpha only</option>
          <option value="beta">Agent only</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-panel">
        {loading && (
          <p className="px-4 py-8 text-center text-sm text-text-muted">Loading agents…</p>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-text-muted">
            <UserCog size={28} className="mx-auto mb-2 opacity-50" />
            No agents yet. Create one above.
          </div>
        )}
        {filtered.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">
                {a.name || "—"}{" "}
                <span className="ml-1 text-xs font-medium text-text-muted">
                  {ROLE_LABELS[a.role] || a.role}
                </span>
                {a.mustChangePassword && (
                  <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Must change password
                  </span>
                )}
              </p>
              <p className="text-xs text-text-muted">{a.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  a.status === "suspended"
                    ? "bg-status-danger/15 text-status-danger"
                    : "bg-accent-soft text-accent"
                }`}
              >
                {a.status === "suspended" ? "Suspended" : "Active"}
              </span>
              {isAdmin(profile) && a.role === "agent" && (
                <button
                  type="button"
                  onClick={() => setPending({ type: "promote", agent: a })}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                  title="Promote to Alpha"
                >
                  <Shield size={14} className="inline" /> Alpha+
                </button>
              )}
              {isAdmin(profile) && a.role === "alphaAgent" && (
                <button
                  type="button"
                  onClick={() => setPending({ type: "demote", agent: a })}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                  title="Demote to Agent"
                >
                  Alpha−
                </button>
              )}
              <button
                type="button"
                onClick={() => forcePasswordReset(a)}
                className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                title="Require password change on next login"
              >
                <KeyRound size={15} />
              </button>

              <button
                type="button"
                onClick={() => navigate(`/admin/agents/${a.id}`)}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-accent hover:bg-bg-elevated"
              >
                Manage & activity
              </button>
              <button
                type="button"
                onClick={() => toggleSuspend(a)}
                className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                title={a.status === "suspended" ? "Activate" : "Suspend"}
              >
                {a.status === "suspended" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <Ban size={15} />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!pending}
        title={pending?.type === "promote" ? "Promote to Alpha" : "Demote to Agent"}
        message={
          pending?.type === "promote"
            ? `Promote ${pending?.agent?.name || pending?.agent?.email} to Agent Alpha?`
            : `Demote ${pending?.agent?.name || pending?.agent?.email} to Agent (Beta)?`
        }
        onCancel={() => setPending(null)}
        onConfirm={runPending}
        confirmLabel={pending?.type === "promote" ? "Promote" : "Demote"}
      />
    </div>
  );
}
