import { useEffect, useMemo, useState } from "react";
import { Newspaper, Feather, ShieldCheck, RotateCcw, Check, Lock, Crown, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { accessApi } from "../../lib/staffApi";
import { can, ROLE_LABELS } from "../../lib/roles";
import { notify } from "../../lib/dialogs";

const RANK = { admin: 4, alphaAgent: 3, agent: 2 };
const rank = (r) => RANK[r] || 1;
const STAFF = ["admin", "alphaAgent", "agent"];
const EMPTY_TAGS = [];

let catalogCache = null;
export function useAccessCatalog() {
  const [catalog, setCatalog] = useState(catalogCache);
  useEffect(() => {
    if (catalogCache) return;
    accessApi.catalog().then((c) => { catalogCache = c; setCatalog(c); }).catch(() => {});
  }, []);
  return catalog;
}

export function defaultsFor(catalog, role, tags = []) {
  if (!catalog) return [];
  const out = new Set(catalog.roleDefaults?.[role] || []);
  for (const t of tags) for (const c of catalog.tagDefaults?.[t] || []) out.add(c);
  return [...out];
}
export function grantableFor(catalog, role, tags = []) {
  if (!catalog) return [];
  return catalog.capabilities
    .filter((c) => (c.scope === "staff" && STAFF.includes(role)) || (c.scope === "secretary" && tags.includes("secretary")))
    .map((c) => c.key);
}

export function Switch({ on, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={`acx-switch ${on ? "is-on" : ""}`}
    >
      <span />
    </button>
  );
}

/**
 * Duties (News, Secretary) and — for admins — the exact permission list of one person.
 */
export default function AccessEditor({ person, viewer, onSaved, compact = false }) {
  const catalog = useAccessCatalog();
  const tags = person.staffTags || EMPTY_TAGS;
  const isTargetAdmin = person.role === "admin";
  const viewerIsAdmin = viewer?.role === "admin";
  const viewerOutranks = viewerIsAdmin || (viewer?.id !== person.id && rank(viewer?.role) > rank(person.role));
  const grantable = useMemo(() => grantableFor(catalog, person.role, tags), [catalog, person.role, tags]);
  const defaults = useMemo(() => defaultsFor(catalog, person.role, tags), [catalog, person.role, tags]);
  const [selected, setSelected] = useState(() => new Set(person.capabilities || []));
  const [custom, setCustom] = useState(!!person.customPermissions);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setSelected(new Set(person.capabilities || []));
    setCustom(!!person.customPermissions);
  }, [person.id, person.capabilities, person.customPermissions]);

  const dirty = useMemo(() => {
    const cur = [...(person.capabilities || [])].sort().join();
    return [...selected].sort().join() !== cur;
  }, [selected, person.capabilities]);

  async function save(body, label) {
    setBusy(label);
    try {
      const { user } = await accessApi.update(person.id, body);
      onSaved?.(user);
      notify.success?.(label === "duty" ? "Duties updated" : "Permissions saved");
    } catch (err) {
      notify.error?.(err.message || "Couldn't save");
    } finally {
      setBusy("");
    }
  }

  const duty = (tag, on) => save({ tags: { [tag]: on } }, "duty");
  const toggle = (key, on) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  };
  const groups = useMemo(() => {
    if (!catalog) return [];
    const map = new Map();
    for (const c of catalog.capabilities) {
      if (!grantable.includes(c.key)) continue;
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group).push(c);
    }
    return [...map.entries()];
  }, [catalog, grantable]);

  const duties = [
    { tag: "news", icon: Newspaper, title: "News Agent", text: "Writes, publishes and moderates Academicall News.", cap: "users.news" },
    { tag: "newsChief", icon: Crown, title: "Chief News Agent", text: "Oversees every story and News Agent: approve, take down, delete, restrict or suspend.", adminOnly: true },
    { tag: "secretary", icon: Feather, title: "Secretary", text: "Runs the Secretariat: records, minutes and the activity journal.", cap: "users.secretary" },
    { tag: "houseLeader", icon: Shield, title: "House Leader", text: "Runs Aspirant Houses: starts threads, pins, mentions and manages members. Pick the houses in Aspirant Houses.", cap: "users.houseLeader" },
  ].filter(() => person.role !== "aspirant");

  return (
    <div className="space-y-5">
      <section className="acx-card">
        <header className="acx-card-head">
          <div>
            <h3>Duties</h3>
            <p>Add-on jobs anyone can hold. They keep their own dashboard and role.</p>
          </div>
        </header>
        <div className="divide-y divide-border-subtle">
          {duties.length === 0 && <p className="py-3 text-sm text-text-muted">Aspirants can't hold staff duties.</p>}
          {duties.map(({ tag, icon: Icon, title, text, cap, adminOnly }) => {
            const on = tags.includes(tag);
            const allowed = adminOnly ? viewerIsAdmin : viewerOutranks && can(viewer, cap);
            return (
              <div key={tag} className="flex items-center gap-3 py-3">
                <span className={`acx-duty-icon ${on ? "is-on" : ""}`}><Icon size={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">{title}</p>
                  <p className="text-xs text-text-muted">{text}</p>
                  {tag === "houseLeader" && on && can(viewer, "users.houseLeader") && <Link to={viewer?.role === "admin" ? "/admin/houses" : "/agent/houses"} className="mt-0.5 inline-block text-xs font-semibold text-accent">Choose houses →</Link>}
                </div>
                {!allowed && <Lock size={14} className="text-text-muted" aria-label="You can't change this" />}
                <Switch on={on} disabled={!allowed || !!busy} onChange={(v) => duty(tag, v)} label={title} />
              </div>
            );
          })}
        </div>
      </section>

      {isTargetAdmin ? (
        <section className="acx-card flex items-center gap-3">
          <ShieldCheck className="text-accent" size={20} />
          <p className="text-sm text-text-secondary">Admins always have every permission. That can't be narrowed.</p>
        </section>
      ) : grantable.length > 0 && (
        <section className="acx-card">
          <header className="acx-card-head">
            <div>
              <h3>What {person.name?.split(" ")[0] || "they"} can do</h3>
              <p>
                {custom ? "Custom set by an admin." : `Using the ${ROLE_LABELS[person.role] || "role"} defaults.`}
                {!viewerIsAdmin && " Only admins can change this."}
              </p>
            </div>
            {viewerIsAdmin && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="acx-btn-ghost" disabled={!!busy} onClick={() => setSelected(new Set(grantable))}>All</button>
                <button type="button" className="acx-btn-ghost" disabled={!!busy} onClick={() => setSelected(new Set())}>None</button>
                {custom && (
                  <button type="button" className="acx-btn-ghost" disabled={!!busy} onClick={() => save({ permissions: null }, "perm")}>
                    <RotateCcw size={13} /> Defaults
                  </button>
                )}
              </div>
            )}
          </header>
          <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-2"}`}>
            {groups.map(([group, caps]) => (
              <div key={group} className="acx-cap-group">
                <p className="acx-cap-group-title">{group}</p>
                {caps.map((c) => {
                  const on = selected.has(c.key);
                  const isDefault = defaults.includes(c.key);
                  return (
                    <label key={c.key} className={`acx-cap ${on ? "is-on" : ""}`}>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[0.85rem] font-medium text-text-primary">
                          {c.label}
                          {isDefault && <span className="acx-pill">default</span>}
                        </span>
                        <span className="block text-xs text-text-muted">{c.hint}</span>
                      </span>
                      <Switch on={on} disabled={!viewerIsAdmin || !!busy} onChange={(v) => toggle(c.key, v)} label={c.label} />
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          {viewerIsAdmin && dirty && (
            <div className="acx-savebar">
              <span>{selected.size} of {grantable.length} switched on</span>
              <div className="flex gap-2">
                <button type="button" className="acx-btn-ghost" onClick={() => setSelected(new Set(person.capabilities || []))}>Undo</button>
                <button type="button" className="acx-btn" disabled={!!busy} onClick={() => save({ permissions: [...selected] }, "perm")}>
                  <Check size={14} /> {busy === "perm" ? "Saving…" : "Save permissions"}
                </button>
              </div>
            </div>
          )}
          <p className="mt-3 text-[11px] text-text-muted">Reserved for admins and never grantable: staff management, platform settings, opening a student's vault.</p>
        </section>
      )}
    </div>
  );
}
