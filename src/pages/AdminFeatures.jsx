/**
 * Admin → Features: maintenance mode, the site-wide banner, and every feature
 * switched on, off, or limited to an audience (students, aspirants, chosen
 * institutions, beta testers).
 *
 * A switched-off feature disappears for students and aspirants straight away:
 * menus, dashboard links and its pages go, and its API stops answering them.
 * Staff keep their management pages so the content can still be looked after.
 *
 * Each feature can also be marked Pro (paid) or Free. That's the same switch as
 * Admin → Billing → Features, so the two pages always agree.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { PageHeader } from "../components/ui";
import { Switch } from "../components/access/AccessEditor";
import { featuresAdminApi, proFeaturesApi, useFeatures } from "../lib/features";
import { featuresExtraApi } from "../lib/gapsApi";
import { institutionsApi } from "../lib/api";
import NewsAccessPanel from "../components/news/NewsAccessPanel";
import { appConfirm, appPrompt, notify } from "../lib/dialogs";

const fmt = (d) => new Date(d).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const toLocal = (d) => (d ? new Date(new Date(d).getTime() + 3600_000).toISOString().slice(0, 16) : "");
const fromLocal = (s) => (s ? new Date(`${s}:00+01:00`).toISOString() : null);

function audienceText(a, names) {
  const parts = [];
  if (a?.roles?.length) parts.push(a.roles.map((r) => (r === "student" ? "students" : "aspirants")).join(" and "));
  if (a?.institutionIds?.length) parts.push(`at ${a.institutionIds.map((id) => names[id] || "an institution").join(", ")}`);
  if (a?.beta) parts.push("beta testers only");
  return parts.join(", ");
}

export default function AdminFeatures() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [limitFor, setLimitFor] = useState(null);
  const [pro, setPro] = useState(null); // { [key]: true } — null while loading or not allowed
  const [proBusy, setProBusy] = useState(null);
  const { reload } = useFeatures();

  const load = () => featuresAdminApi.list().then(setData).catch((e) => setError(e.message));
  const loadPro = () => proFeaturesApi.list().then((r) => setPro(Object.fromEntries((r.features || []).map((f) => [f.key, f.pro])))).catch(() => setPro(null));
  useEffect(() => { load(); loadPro(); }, []);

  async function setPaid(f, next) {
    const ok = await appConfirm(
      next ? `Free accounts lose ${f.label} straight away and see an upgrade prompt instead. Pro accounts and staff keep it.` : `${f.label} opens for every account, free or Pro.`,
      { title: next ? `Make ${f.label} a Pro feature?` : `Make ${f.label} free?`, confirmLabel: next ? "Make it Pro" : "Make it free" },
    );
    if (!ok) return;
    setProBusy(f.key);
    try { await proFeaturesApi.set(f.key, next); setPro((p) => ({ ...(p || {}), [f.key]: next })); notify.success(next ? `${f.label} is now Pro` : `${f.label} is free for everyone`); }
    catch (e) { notify.error(e.message); } finally { setProBusy(null); }
  }
  const names = useMemo(() => Object.fromEntries((data?.institutions || []).map((i) => [i.id, i.abbreviation || i.displayName || i.name])), [data]);

  const groups = useMemo(() => {
    const out = [];
    for (const f of data?.features || []) {
      let g = out.find((x) => x.name === f.group);
      if (!g) { g = { name: f.group, items: [] }; out.push(g); }
      g.items.push(f);
    }
    return out;
  }, [data]);

  async function setMode(f, mode, audience) {
    let note = null;
    if (mode === "off") {
      note = await appPrompt(`${f.label} will disappear from Academicall for students and aspirants straight away. Their data is kept, and you can switch it back on any time.`, { title: `Switch off ${f.label}?`, placeholder: "Reason, for the team (optional)", confirmLabel: "Switch off" });
      if (note === null) return;
    } else if (mode === "on" && f.mode !== "on") {
      if (!(await appConfirm(`${f.label} comes back for everyone straight away.`, { title: `Switch on ${f.label}?`, confirmLabel: "Switch on" }))) return;
    }
    setBusy(f.key);
    try {
      await featuresExtraApi.setMode(f.key, mode, audience, note || null);
      await load();
      reload();
      notify.success(mode === "on" ? `${f.label} is on for everyone` : mode === "off" ? `${f.label} is switched off` : `${f.label} is limited`);
      setLimitFor(null);
    } catch (e) { notify.error(e.message); } finally { setBusy(null); }
  }

  const offCount = (data?.features || []).filter((f) => f.mode === "off").length;
  const limitedCount = (data?.features || []).filter((f) => f.mode === "limited").length;

  return (
    <div className="ctl space-y-5">
      <PageHeader title="Features" description="Maintenance mode, a banner for everyone, and each feature on, off, or limited to an audience. Nothing is deleted when a feature goes off." />
      {error && <p className="ctl-error">{error}</p>}
      {!data && !error && <div className="ctl-panel flex items-center gap-2 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>}
      {data && (
        <>
          <MaintenancePanel value={data.maintenance} onSaved={() => { load(); reload(); }} />
          <BannerPanel value={data.banner} onSaved={() => { load(); reload(); }} />
          <NewsAccessPanel />
          <p className="text-sm text-text-secondary">
            {offCount || limitedCount ? <><b className="num text-text-primary">{offCount}</b> off and <b className="num text-text-primary">{limitedCount}</b> limited, of {data.features.length} features.</> : `All ${data.features.length} features are on for everyone.`}
          </p>
          {groups.map((g) => (
            <section key={g.name} className="ctl-panel !p-0">
              <h2 className="ctl-panel-title">{g.name}</h2>
              <ul>
                {g.items.map((f) => (
                  <li key={f.key} className={`ctl-feature flex-wrap ${f.mode === "off" ? "is-off" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-text-primary">
                        {f.label}
                        {f.mode === "off" && <span className="ctl-status is-removed">Off</span>}
                        {f.mode === "limited" && <span className="ctl-status is-edited">Limited</span>}
                        {pro?.[f.key] && <span className="ctl-status is-added">Pro</span>}
                      </p>
                      <p className="text-sm text-text-secondary">{f.hint}</p>
                      {f.mode === "off" && f.off && <p className="mt-1 text-xs text-text-muted">Switched off {fmt(f.off.at)}{f.off.byName ? ` by ${f.off.byName}` : ""}{f.off.note ? `: ${f.off.note}` : ""}</p>}
                      {f.mode === "limited" && f.limited && <p className="mt-1 text-xs text-text-muted">Only {audienceText(f.limited.audience, names)} · since {fmt(f.limited.at)}{f.limited.byName ? ` by ${f.limited.byName}` : ""}</p>}
                    </div>
                    {pro && f.key !== "upgrade" && (proBusy === f.key ? <Loader2 size={18} className="animate-spin text-text-muted" /> : (
                      <div className="utme-filter" role="group" aria-label={`Who can use ${f.label}`}>
                        <button type="button" className={!pro[f.key] ? "is-on" : ""} onClick={() => pro[f.key] && setPaid(f, false)}>Free</button>
                        <button type="button" className={pro[f.key] ? "is-on" : ""} onClick={() => !pro[f.key] && setPaid(f, true)}>Pro</button>
                      </div>
                    ))}
                    {busy === f.key ? <Loader2 size={18} className="animate-spin text-text-muted" /> : (
                      <div className="utme-filter">
                        <button type="button" className={f.mode === "on" ? "is-on" : ""} onClick={() => f.mode !== "on" && setMode(f, "on")}>On</button>
                        <button type="button" className={f.mode === "limited" ? "is-on" : ""} onClick={() => setLimitFor(limitFor === f.key ? null : f.key)}>Limited</button>
                        <button type="button" className={f.mode === "off" ? "is-on" : ""} onClick={() => f.mode !== "off" && setMode(f, "off")}>Off</button>
                      </div>
                    )}
                    {limitFor === f.key && <LimitEditor feature={f} names={names} betaCount={data.betaCount} onCancel={() => setLimitFor(null)} onSave={(aud) => setMode(f, "limited", aud)} />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <BetaTesters onChanged={load} />
          <p className="text-xs text-text-muted">Free / Pro decides who can use a feature that's on: Pro features ask free accounts to upgrade. For Library sharing, only sending is Pro; anyone can still receive and add what's shared with them. Dashboard, notifications, profile and settings are always on. The dashboard board is managed from its own page.</p>
        </>
      )}
    </div>
  );
}

function LimitEditor({ feature, names, betaCount, onSave, onCancel }) {
  const cur = feature.limited?.audience || {};
  const [roles, setRoles] = useState(cur.roles || []);
  const [insts, setInsts] = useState((cur.institutionIds || []).map((id) => ({ id, label: names[id] || id.slice(0, 6) })));
  const [beta, setBeta] = useState(!!cur.beta);
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return undefined; }
    const t = setTimeout(() => institutionsApi.search({ q: q.trim(), limit: 8 }).then((r) => setRes(r.institutions || [])).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  const tog = (r) => setRoles((xs) => (xs.includes(r) ? xs.filter((x) => x !== r) : [...xs, r]));
  return (
    <div className="aud-box mt-2 w-full space-y-3">
      <p className="text-sm text-text-primary">Who still sees <b>{feature.label}</b>? Everyone else sees it switched off. Staff always see it.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`aud-tog ${roles.includes("student") ? "is-on" : ""}`} onClick={() => tog("student")}>Students</button>
        <button type="button" className={`aud-tog ${roles.includes("aspirant") ? "is-on" : ""}`} onClick={() => tog("aspirant")}>Aspirants</button>
        <button type="button" className={`aud-tog ${beta ? "is-on" : ""}`} onClick={() => setBeta((v) => !v)}>Beta testers only ({betaCount})</button>
      </div>
      <div className="relative">
        <div className="ctl-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Only at these institutions… (optional)" /></div>
        {res.length > 0 && <ul className="aud-pop">{res.map((i) => <li key={i.id}><button type="button" onClick={() => { setInsts((xs) => (xs.some((x) => x.id === i.id) ? xs : [...xs, { id: i.id, label: i.abbreviation || i.displayName || i.name }])); setQ(""); }}>{i.displayName || i.name}</button></li>)}</ul>}
      </div>
      {insts.length > 0 && <div className="aud-chips">{insts.map((i) => <span key={i.id} className="aud-chip">{i.label}<button type="button" onClick={() => setInsts((xs) => xs.filter((x) => x.id !== i.id))}><X size={11} /></button></span>)}</div>}
      <p className="text-xs text-text-muted">Choices combine: “Students” + “UNILAG” means UNILAG students only.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="ctl-btn is-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="ctl-btn" disabled={!roles.length && !insts.length && !beta} onClick={() => onSave({ roles, institutionIds: insts.map((i) => i.id), beta })}>Limit {feature.label}</button>
      </div>
    </div>
  );
}

function MaintenancePanel({ value, onSaved }) {
  const [msg, setMsg] = useState(value?.message || "");
  const [until, setUntil] = useState(toLocal(value?.until));
  const on = !!value?.on;
  async function toggle(next) {
    const ok = await appConfirm(next ? "Everyone except staff sees a “Back soon” screen and can't use Academicall until you switch this off." : "Academicall opens for everyone again.", { title: next ? "Turn on maintenance mode?" : "End maintenance?", confirmLabel: next ? "Turn on" : "End maintenance", tone: next ? "danger" : undefined });
    if (!ok) return;
    try { await featuresExtraApi.maintenance({ on: next, message: msg || null, until: fromLocal(until) }); onSaved(); notify.success(next ? "Maintenance mode is on" : "Academicall is open again"); }
    catch (e) { notify.error(e.message); }
  }
  return (
    <section className={`ctl-panel space-y-3 ${on ? "maint-on" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary">Maintenance mode {on && <span className="ctl-status is-removed ml-1">On</span>}</p>
          <p className="text-sm text-text-secondary">Close Academicall for everyone but staff while you update the database or fix something big.</p>
        </div>
        <Switch on={on} onChange={toggle} label="Maintenance mode" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
        <input className="ctl-input" value={msg} maxLength={300} onChange={(e) => setMsg(e.target.value)} placeholder="Message, e.g. We're upgrading Academicall. Back by 6 pm." />
        <input type="datetime-local" className="ctl-input" value={until} onChange={(e) => setUntil(e.target.value)} title="Ends automatically at (Lagos time)" />
      </div>
      {on && <button type="button" className="ctl-btn is-ghost" onClick={() => featuresExtraApi.maintenance({ on: true, message: msg || null, until: fromLocal(until) }).then(() => { onSaved(); notify.success("Updated"); }).catch((e) => notify.error(e.message))}>Update message</button>}
    </section>
  );
}

function BannerPanel({ value, onSaved }) {
  const [b, setB] = useState({ text: value?.text || "", tone: value?.tone || "info", linkLabel: value?.linkLabel || "", linkUrl: value?.linkUrl || "", audience: value?.audience || "all", until: toLocal(value?.until) });
  const on = !!value?.on;
  const set = (p) => setB((x) => ({ ...x, ...p }));
  async function save(nextOn) {
    try {
      await featuresExtraApi.banner({ on: nextOn, text: b.text || null, tone: b.tone, linkLabel: b.linkLabel || null, linkUrl: b.linkUrl || null, audience: b.audience, until: fromLocal(b.until) });
      onSaved();
      notify.success(nextOn ? "Banner is live" : "Banner removed");
    } catch (e) { notify.error(e.message); }
  }
  return (
    <section className="ctl-panel space-y-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary">Site banner {on && <span className="ctl-status is-added ml-1">Live</span>}</p>
          <p className="text-sm text-text-secondary">A line across the top of every page: exam dates, downtime notices, a new feature.</p>
        </div>
        {on && <button type="button" className="ctl-btn is-ghost" onClick={() => save(false)}>Take down</button>}
      </div>
      <input className="ctl-input" value={b.text} maxLength={240} onChange={(e) => set({ text: e.target.value })} placeholder="e.g. Free UTME mock this Saturday, 10 am. Find it under Tests." />
      <div className="grid gap-2 sm:grid-cols-4">
        <select className="ctl-input" value={b.tone} onChange={(e) => set({ tone: e.target.value })}><option value="info">Notice</option><option value="warning">Warning</option><option value="success">Good news</option></select>
        <select className="ctl-input" value={b.audience} onChange={(e) => set({ audience: e.target.value })}><option value="all">Everyone</option><option value="students">Students</option><option value="aspirants">Aspirants</option></select>
        <input className="ctl-input" value={b.linkLabel} maxLength={40} onChange={(e) => set({ linkLabel: e.target.value })} placeholder="Link text (optional)" />
        <input className="ctl-input" value={b.linkUrl} onChange={(e) => set({ linkUrl: e.target.value })} placeholder="/dashboard/tests or https://…" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-text-secondary">Ends <input type="datetime-local" className="ctl-input !inline-block !w-56" value={b.until} onChange={(e) => set({ until: e.target.value })} /></label>
        <span className="flex-1" />
        {b.text && <div className={`site-banner is-${b.tone} !static !m-0 w-full sm:w-auto`}><p>{b.text}</p>{b.linkUrl && <a href="#preview" onClick={(e) => e.preventDefault()}>{b.linkLabel || "Open"}</a>}</div>}
        <button type="button" className="ctl-btn" disabled={!b.text.trim()} onClick={() => save(true)}>{on ? "Update banner" : "Publish banner"}</button>
      </div>
    </section>
  );
}

function BetaTesters({ onChanged }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const load = (term = q) => featuresExtraApi.betaTesters(term).then(setData).catch(() => {});
  useEffect(() => { const t = setTimeout(() => load(q), 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  async function setBeta(u, on) {
    await featuresExtraApi.setBeta(u.id, on).catch((e) => notify.error(e.message));
    load(); onChanged?.();
  }
  return (
    <section className="ctl-panel space-y-3">
      <p className="font-semibold text-text-primary">Beta testers</p>
      <p className="text-sm text-text-secondary">People who see features you've limited to beta testers.</p>
      <div className="relative">
        <div className="ctl-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add someone: name, email or Unique ID" /></div>
        {data?.matches?.length > 0 && q.length >= 2 && (
          <ul className="aud-pop">{data.matches.map((u) => <li key={u.id}><button type="button" onClick={() => { setBeta(u, !u.betaTester); setQ(""); }}>{u.name || u.email} <span className="text-xs text-text-muted">{u.uniqueId || u.email}{u.betaTester ? " · already a tester" : ""}</span></button></li>)}</ul>
        )}
      </div>
      {!data?.testers?.length ? <p className="text-sm text-text-muted">No beta testers yet.</p> : (
        <div className="aud-chips">{data.testers.map((u) => <span key={u.id} className="aud-chip">{u.name || u.email}<button type="button" onClick={() => setBeta(u, false)} aria-label="Remove"><X size={11} /></button></span>)}</div>
      )}
    </section>
  );
}
