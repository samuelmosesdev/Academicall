import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Loader2, MapPin, Search } from "lucide-react";
import { useInstitutionSearch, useInstitutionTree, institutionLabel } from "../../hooks/useInstitutions";

/**
 * Pick an institution from the national list (1,600+), then the course you hope to study there.
 * Courses come from that institution's programme list; free text is fine too.
 */
export function InstitutionChoice({ label, hint, value, onChange, exclude, required, optional, onClear }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { results, loading } = useInstitutionSearch(query, { enabled: open });
  const { tree } = useInstitutionTree(value?.institution?.id);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const programmes = useMemo(() => {
    const out = new Map();
    for (const f of tree?.faculties || []) for (const d of f.departments || []) for (const p of d.programs || []) out.set(p.name, p.id);
    return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tree]);

  const inst = value?.institution;
  const listId = `courses-${label.replace(/\W/g, "")}`;

  return (
    <div className="asp-choice" ref={ref}>
      <div className="flex items-center justify-between">
        <p className="asp-choice-label">{label} {optional && <span className="font-normal text-text-muted">(optional)</span>}</p>
        {inst && onClear && <button type="button" onClick={onClear} className="text-xs font-medium text-text-muted hover:text-status-danger">Remove</button>}
      </div>
      {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}

      <button type="button" onClick={() => setOpen((o) => !o)} className={`asp-inst-btn ${inst ? "is-set" : ""}`} aria-expanded={open} aria-required={required}>
        <span className="asp-inst-icon"><Building2 size={16} /></span>
        <span className="min-w-0 flex-1 text-left">
          {inst ? (
            <>
              <span className="block truncate text-[0.92rem] font-semibold text-text-primary">{institutionLabel(inst)}</span>
              <span className="block truncate text-xs text-text-muted">{[inst.abbreviation, inst.state, inst.ownership].filter(Boolean).join(" · ")}</span>
            </>
          ) : (
            <span className="text-[0.9rem] text-text-muted">Search universities, polytechnics, colleges…</span>
          )}
        </span>
        <ChevronDown size={16} className={`text-text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="asp-inst-pop" role="listbox">
          <label className="relative block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a name, abbreviation or state" className="acx-input pl-9" />
          </label>
          <div className="mt-2 max-h-64 overflow-y-auto">
            {loading && <p className="flex items-center gap-2 px-2 py-3 text-xs text-text-muted"><Loader2 size={13} className="animate-spin" /> Searching…</p>}
            {!loading && results.length === 0 && <p className="px-2 py-3 text-xs text-text-muted">No institution matches “{query}”.</p>}
            {results.filter((r) => r.id !== exclude).map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={inst?.id === r.id}
                onClick={() => { onChange({ institution: r, course: "", programId: "" }); setOpen(false); setQuery(""); }}
                className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-bg-panel-alt"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.86rem] font-medium leading-snug text-text-primary">{institutionLabel(r)}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-text-muted"><MapPin size={11} /> {[r.state, r.type, r.ownership].filter(Boolean).join(" · ")}</span>
                </span>
                {inst?.id === r.id && <Check size={15} className="mt-1 text-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {inst && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-text-secondary">Course you want to study there</label>
          <input
            list={listId}
            value={value.course || ""}
            onChange={(e) => {
              const course = e.target.value;
              const hit = programmes.find(([name]) => name.toLowerCase() === course.toLowerCase());
              onChange({ ...value, course, programId: hit ? hit[1] : "" });
            }}
            placeholder={programmes.length ? "Start typing, e.g. Medicine and Surgery" : "e.g. Computer Science"}
            className="acx-input"
            maxLength={160}
          />
          <datalist id={listId}>{programmes.map(([name]) => <option key={name} value={name} />)}</datalist>
        </div>
      )}
    </div>
  );
}

const STATES = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];

/** Turn saved aspirations (from /auth/me) into form state. */
export function choicesFromProfile(profile) {
  const list = profile?.aspirations || [];
  const pick = (rank) => {
    const a = list.find((x) => x.rank === rank);
    return a ? { institution: a.institution, course: a.course || "", programId: a.programId || "" } : null;
  };
  return { first: pick(1), second: pick(2) };
}

/**
 * First choice (required) + second choice (optional, max two), plus UTME details.
 * onSubmit receives the body for PUT /aspirant/me.
 */
export default function AspirantChoicesForm({ profile, submitLabel = "Save my choices", busyLabel = "Saving…", onSubmit, extra, compact = false }) {
  const initial = choicesFromProfile(profile);
  const meta = profile?.aspirantMeta || {};
  const [first, setFirst] = useState(initial.first);
  const [second, setSecond] = useState(initial.second);
  const [showSecond, setShowSecond] = useState(!!initial.second);
  const [phone, setPhone] = useState(profile?.phone || "");
  const [utmeYear, setUtmeYear] = useState(meta.utmeYear || new Date().getFullYear());
  const [utmeScore, setUtmeScore] = useState(meta.utmeScore ?? "");
  const [stateOfOrigin, setStateOfOrigin] = useState(meta.stateOfOrigin || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!first?.institution?.id) { setError("Choose your first-choice institution."); return; }
    if (second?.institution?.id && second.institution.id === first.institution.id) { setError("Your second choice must be a different institution."); return; }
    const score = utmeScore === "" ? null : Number(utmeScore);
    if (score !== null && (Number.isNaN(score) || score < 0 || score > 400)) { setError("UTME scores run from 0 to 400."); return; }
    setBusy(true);
    try {
      await onSubmit({
        firstChoice: { institutionId: first.institution.id, course: first.course || null, programId: first.programId || null },
        secondChoice: showSecond && second?.institution?.id ? { institutionId: second.institution.id, course: second.course || null, programId: second.programId || null } : null,
        phone: phone.trim() || null,
        meta: { utmeYear: utmeYear ? Number(utmeYear) : null, utmeScore: score, stateOfOrigin: stateOfOrigin || null },
      });
    } catch (err) {
      setError(err.message || "Couldn't save your choices");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">{error}</p>}
      {extra}
      <InstitutionChoice label="First choice" hint="Where you most want to get in. You join its Aspirant House." value={first} onChange={setFirst} exclude={second?.institution?.id} required />
      {showSecond ? (
        <InstitutionChoice label="Second choice" optional value={second} onChange={setSecond} exclude={first?.institution?.id} onClear={() => { setSecond(null); setShowSecond(false); }} />
      ) : (
        <button type="button" onClick={() => setShowSecond(true)} className="asp-add-second">+ Add a second choice <span className="text-text-muted">(optional · max two)</span></button>
      )}
      <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">UTME year</label>
          <input type="number" min="2015" max="2100" value={utmeYear} onChange={(e) => setUtmeYear(e.target.value)} className="acx-input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">UTME score <span className="text-text-muted">(if out)</span></label>
          <input type="number" min="0" max="400" value={utmeScore} onChange={(e) => setUtmeScore(e.target.value)} placeholder="e.g. 268" className="acx-input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">State of origin</label>
          <select value={stateOfOrigin} onChange={(e) => setStateOfOrigin(e.target.value)} className="acx-input">
            <option value="">Select</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Phone number <span className="text-text-muted">(optional)</span></label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 080…" className="acx-input" />
      </div>
      <button type="submit" disabled={busy || !first?.institution?.id} className="asp-primary w-full">
        {busy ? <><Loader2 size={15} className="animate-spin" /> {busyLabel}</> : submitLabel}
      </button>
      {first?.institution && (
        <p className="text-xs text-text-muted">You'll join {showSecond && second?.institution ? "two Aspirant Houses" : "the Aspirant House"} for {[first, showSecond ? second : null].filter((c) => c?.institution).map((c) => institutionLabel(c.institution)).join(" and ")}.</p>
      )}
    </form>
  );
}
