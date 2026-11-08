/**
 * "Who is this test for?" — students by institution/faculty/department/
 * programme/level, aspirants by house/institution of choice/UTME year, plan,
 * and named people. Shows a live count of who matches.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { institutionsApi } from "../../lib/api";
import { testsApi } from "../../lib/gapsApi";

export const EMPTY_AUDIENCE = {
  roles: [], institutionIds: [], facultyIds: [], departmentIds: [], programIds: [], levels: [],
  houseIds: [], choiceInstitutionIds: [], utmeYears: [], plans: [], userIds: [], onlyPeople: false,
};

const instName = (i) => i?.abbreviation || i?.displayName || i?.name || "Institution";
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Chips({ items, onRemove }) {
  if (!items.length) return null;
  return (
    <div className="aud-chips">
      {items.map((it) => (
        <span key={it.id} className="aud-chip">{it.label}<button type="button" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.label}`}><X size={11} /></button></span>
      ))}
    </div>
  );
}

function InstitutionSearch({ onPick, placeholder }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return undefined; }
    const t = setTimeout(() => institutionsApi.search({ q: q.trim(), limit: 8 }).then((r) => setRes(r.institutions || [])).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative">
      <div className="ctl-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} /></div>
      {res.length > 0 && (
        <ul className="aud-pop">
          {res.map((i) => <li key={i.id}><button type="button" onClick={() => { onPick(i); setQ(""); setRes([]); }}>{i.displayName || i.name}{i.abbreviation ? ` (${i.abbreviation})` : ""}</button></li>)}
        </ul>
      )}
    </div>
  );
}

export default function TestAudience({ value, onChange, labels, setLabels }) {
  const a = { ...EMPTY_AUDIENCE, ...value };
  const set = (patch) => onChange({ ...a, ...patch });
  const [opts, setOpts] = useState(null);
  const [trees, setTrees] = useState({});
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [personQ, setPersonQ] = useState("");
  const [people, setPeople] = useState([]);
  const label = (id) => labels[id] || id.slice(0, 6);
  const remember = (id, text) => setLabels((m) => ({ ...m, [id]: text }));

  useEffect(() => { testsApi.options().then(setOpts).catch(() => setOpts({ houses: [], levels: [] })); }, []);
  useEffect(() => {
    a.institutionIds.forEach((id) => {
      if (!trees[id]) institutionsApi.tree(id).then((t) => setTrees((m) => ({ ...m, [id]: t }))).catch(() => {});
    });
  }, [a.institutionIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setBusy(true);
    const t = setTimeout(() => testsApi.preview(cleanAudience(a)).then(setPreview).catch(() => setPreview(null)).finally(() => setBusy(false)), 350);
    return () => clearTimeout(t);
  }, [JSON.stringify(a)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (personQ.trim().length < 2) { setPeople([]); return undefined; }
    const t = setTimeout(() => testsApi.people(personQ.trim()).then((r) => setPeople(r.items)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [personQ]);
  // Names for people already picked (editing a saved test)
  useEffect(() => {
    const missing = a.userIds.filter((id) => !labels[id]);
    if (missing.length) testsApi.people("", missing).then((r) => r.items.forEach((p) => remember(p.id, p.name || p.email))).catch(() => {});
  }, [a.userIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const faculties = useMemo(() => Object.values(trees).flatMap((t) => (t.faculties || []).map((f) => ({ ...f, inst: t.institution }))), [trees]);
  const departments = useMemo(() => faculties.filter((f) => !a.facultyIds.length || a.facultyIds.includes(f.id)).flatMap((f) => f.departments || []), [faculties, a.facultyIds]);
  const programmes = useMemo(() => departments.filter((d) => !a.departmentIds.length || a.departmentIds.includes(d.id)).flatMap((d) => d.programs || []), [departments, a.departmentIds]);
  const students = !a.roles.length || a.roles.includes("student");
  const aspirants = !a.roles.length || a.roles.includes("aspirant");
  const years = (() => { const y = new Date().getFullYear(); return [y, y + 1, y + 2].map(String); })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-text-primary">For</span>
        <div className="utme-filter">
          {[["all", "Students and aspirants"], ["student", "Students"], ["aspirant", "Aspirants"], ["people", "Only people I pick"]].map(([k, l]) => {
            const on = k === "all" ? !a.roles.length && !a.onlyPeople : k === "people" ? !!a.onlyPeople : a.roles.length === 1 && a.roles[0] === k && !a.onlyPeople;
            return <button type="button" key={k} className={on ? "is-on" : ""} onClick={() => set(k === "all" ? { roles: [], onlyPeople: false } : k === "people" ? { roles: [], onlyPeople: true } : { roles: [k], onlyPeople: false })}>{l}</button>;
          })}
        </div>
      </div>

      {!a.onlyPeople && students && (
        <fieldset className="aud-box">
          <legend>Students</legend>
          <InstitutionSearch placeholder="Limit to institutions… (leave empty for all)" onPick={(i) => { remember(i.id, instName(i)); set({ institutionIds: [...new Set([...a.institutionIds, i.id])] }); }} />
          <Chips items={a.institutionIds.map((id) => ({ id, label: label(id) }))} onRemove={(id) => set({ institutionIds: a.institutionIds.filter((x) => x !== id), facultyIds: [], departmentIds: [], programIds: [] })} />
          {faculties.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3">
              <select className="ctl-input" value="" onChange={(e) => { const f = faculties.find((x) => x.id === e.target.value); if (f) { remember(f.id, f.name); set({ facultyIds: [...new Set([...a.facultyIds, f.id])] }); } }}>
                <option value="">+ Faculty</option>{faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <select className="ctl-input" value="" onChange={(e) => { const d = departments.find((x) => x.id === e.target.value); if (d) { remember(d.id, d.name); set({ departmentIds: [...new Set([...a.departmentIds, d.id])] }); } }}>
                <option value="">+ Department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className="ctl-input" value="" onChange={(e) => { const p = programmes.find((x) => x.id === e.target.value); if (p) { remember(p.id, p.name); set({ programIds: [...new Set([...a.programIds, p.id])] }); } }}>
                <option value="">+ Programme</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <Chips items={[...a.facultyIds, ...a.departmentIds, ...a.programIds].map((id) => ({ id, label: label(id) }))} onRemove={(id) => set({ facultyIds: a.facultyIds.filter((x) => x !== id), departmentIds: a.departmentIds.filter((x) => x !== id), programIds: a.programIds.filter((x) => x !== id) })} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-secondary">Levels</span>
            {(opts?.levels || []).map((l) => <button type="button" key={l} className={`aud-tog ${a.levels.includes(l) ? "is-on" : ""}`} onClick={() => set({ levels: toggle(a.levels, l) })}>{l}L</button>)}
          </div>
        </fieldset>
      )}

      {!a.onlyPeople && aspirants && (
        <fieldset className="aud-box">
          <legend>Aspirants</legend>
          <select className="ctl-input" value="" onChange={(e) => { const h = opts?.houses.find((x) => x.id === e.target.value); if (h) { remember(h.id, h.name); set({ houseIds: [...new Set([...a.houseIds, h.id])] }); } }}>
            <option value="">+ Aspirant House (leave empty for all)</option>
            {(opts?.houses || []).map((h) => <option key={h.id} value={h.id}>{h.name} · {h.memberCount} members</option>)}
          </select>
          <Chips items={a.houseIds.map((id) => ({ id, label: label(id) }))} onRemove={(id) => set({ houseIds: a.houseIds.filter((x) => x !== id) })} />
          <InstitutionSearch placeholder="Aspirants who chose these institutions…" onPick={(i) => { remember(i.id, instName(i)); set({ choiceInstitutionIds: [...new Set([...a.choiceInstitutionIds, i.id])] }); }} />
          <Chips items={a.choiceInstitutionIds.map((id) => ({ id, label: `Chose ${label(id)}` }))} onRemove={(id) => set({ choiceInstitutionIds: a.choiceInstitutionIds.filter((x) => x !== id) })} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-secondary">UTME year</span>
            {years.map((y) => <button type="button" key={y} className={`aud-tog ${a.utmeYears.includes(y) ? "is-on" : ""}`} onClick={() => set({ utmeYears: toggle(a.utmeYears, y) })}>{y}</button>)}
          </div>
        </fieldset>
      )}

      {!a.onlyPeople && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-secondary">Plan</span>
          {[["free", "Free"], ["pro", "Pro"], ["annual", "Annual"]].map(([k, l]) => <button type="button" key={k} className={`aud-tog ${a.plans.includes(k) ? "is-on" : ""}`} onClick={() => set({ plans: toggle(a.plans, k) })}>{l}</button>)}
          <span className="text-xs text-text-muted">(none picked = every plan)</span>
        </div>
      )}

      <fieldset className="aud-box">
        <legend>{a.onlyPeople ? "People" : "Also include these people"}</legend>
        <div className="relative">
          <div className="ctl-search"><Search size={14} /><input value={personQ} onChange={(e) => setPersonQ(e.target.value)} placeholder="Name, email or Unique ID" /></div>
          {people.length > 0 && (
            <ul className="aud-pop">
              {people.map((p) => <li key={p.id}><button type="button" onClick={() => { remember(p.id, p.name || p.email); set({ userIds: [...new Set([...a.userIds, p.id])] }); setPersonQ(""); }}>{p.name || p.email} <span className="text-xs text-text-muted">{p.role === "aspirant" ? "Aspirant" : `Student${p.level ? ` · ${p.level}L` : ""}`}{p.uniqueId ? ` · ${p.uniqueId}` : ""}</span></button></li>)}
            </ul>
          )}
        </div>
        <Chips items={a.userIds.map((id) => ({ id, label: label(id) }))} onRemove={(id) => set({ userIds: a.userIds.filter((x) => x !== id) })} />
      </fieldset>

      <p className="aud-count">
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        <b className="num">{preview?.count ?? "—"}</b> {preview?.count === 1 ? "person matches" : "people match"}
        {preview?.label ? <span className="text-text-muted"> · {preview.label}</span> : null}
      </p>
    </div>
  );
}

/** What the API stores: picking "only people" clears the group filters. */
export function cleanAudience(a) {
  const x = { ...EMPTY_AUDIENCE, ...a };
  return x.onlyPeople ? { ...EMPTY_AUDIENCE, userIds: x.userIds, onlyPeople: true } : x;
}
