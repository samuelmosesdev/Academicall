import { useState } from "react";
import { Building2, Target, X } from "lucide-react";
import { useInstitutionSearch, institutionLabel } from "../../hooks/useInstitutions";

const GROUPS = [["students", "Students"], ["aspirants", "Aspirants"], ["staff", "Staff"]];
const LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "Postgraduate"];

export function audienceSummary(a) {
  if (!a) return "Everyone";
  const parts = [];
  if (a.groups?.length) parts.push(a.groups.map((g) => g[0].toUpperCase() + g.slice(1)).join(" & "));
  if (a.institutionIds?.length) parts.push(`${a.institutionIds.length} institution${a.institutionIds.length > 1 ? "s" : ""}`);
  if (a.levels?.length) parts.push(a.levels.join(", "));
  return parts.join(" · ") || "Everyone";
}

/**
 * Who a story is aimed at. Everyone can still read it on the news page; the chosen
 * audience gets it first (a notification the moment it's published, and the top of their For you).
 */
export default function AudiencePicker({ value, onChange }) {
  const a = value || {};
  const [open, setOpen] = useState(!!value);
  const [q, setQ] = useState("");
  const [names, setNames] = useState({});
  const { results } = useInstitutionSearch(q, { enabled: q.trim().length > 1 });
  const update = (patch) => {
    const next = { ...a, ...patch };
    const clean = { groups: next.groups?.length ? next.groups : undefined, institutionIds: next.institutionIds?.length ? next.institutionIds : undefined, levels: next.levels?.length ? next.levels : undefined };
    onChange(clean.groups || clean.institutionIds || clean.levels ? clean : null);
  };
  const toggle = (key, v) => update({ [key]: (a[key] || []).includes(v) ? a[key].filter((x) => x !== v) : [...(a[key] || []), v] });

  return (
    <div className="rounded-2xl border border-border-light bg-card-light p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet"><Target size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Audience</p>
          <p className="text-xs text-ink-muted">Everyone can read it. The people you pick get it first: notified the moment it's live.</p>
        </div>
        <button type="button" onClick={() => { if (open) onChange(null); setOpen(!open); }} className={`news-cat ${open ? "on" : ""}`}>{open ? "Targeted" : "Everyone"}</button>
      </div>
      {open && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Who</p>
            <div className="flex flex-wrap gap-2">{GROUPS.map(([k, l]) => <button key={k} type="button" onClick={() => toggle("groups", k)} className={`news-cat ${(a.groups || []).includes(k) ? "on" : ""}`}>{l}</button>)}</div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Institutions <span className="normal-case tracking-normal">(students there, and aspirants who chose them)</span></p>
            <div className="flex flex-wrap gap-2">
              {(a.institutionIds || []).map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2.5 py-1 text-xs font-medium text-violet">{names[id] || id}<button type="button" onClick={() => toggle("institutionIds", id)} aria-label="Remove"><X size={11} /></button></span>)}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add an institution" className="mt-2 w-full rounded-full border border-border-light bg-paper px-4 py-2 text-sm outline-none focus:border-violet" />
            {q.trim().length > 1 && (
              <div className="mt-1 max-h-44 overflow-y-auto rounded-2xl border border-border-light bg-card-light">
                {results.slice(0, 6).map((r) => (
                  <button key={r.id} type="button" onClick={() => { setNames((n) => ({ ...n, [r.id]: institutionLabel(r) })); if (!(a.institutionIds || []).includes(r.id)) toggle("institutionIds", r.id); setQ(""); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-hover"><Building2 size={13} className="text-violet" /> {institutionLabel(r)}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Levels</p>
            <div className="flex flex-wrap gap-2">{LEVELS.map((l) => <button key={l} type="button" onClick={() => toggle("levels", l)} className={`news-cat ${(a.levels || []).includes(l) ? "on" : ""}`}>{l}</button>)}</div>
          </div>
          <p className="rounded-xl bg-paper px-3 py-2 text-xs text-ink-muted">Aimed at: <b className="text-ink">{audienceSummary(value)}</b></p>
        </div>
      )}
    </div>
  );
}
