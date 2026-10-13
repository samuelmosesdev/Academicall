import { useEffect, useMemo, useRef, useState } from "react";
import { Building, Check, ChevronDown, Info, Loader2, Search } from "lucide-react";
import { institutionLabel, prettyName, useInstitutionSearch, useInstitutionTree } from "../hooks/useInstitutions";
import { requestsApi } from "../lib/api";
import { notify } from "../lib/dialogs";

const selectCls =
  "w-full rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const labelCls = "mb-1 block text-xs font-medium text-text-secondary";
const EMPTY_FACULTIES = [];

function InstitutionCombobox({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { results, loading, error } = useInstitutionSearch(query, { enabled: open });
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${selectCls} flex items-center gap-2 text-left`}
      >
        <Building size={15} className="shrink-0 text-text-muted" />
        <span className={`min-w-0 flex-1 truncate ${value ? "" : "text-text-muted"}`}>
          {value ? institutionLabel(value) : "Search for your university, polytechnic or college"}
        </span>
        {value?.abbreviation && <span className="shrink-0 rounded bg-bg-panel px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">{value.abbreviation}</span>}
        <ChevronDown size={15} className="shrink-0 text-text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border-subtle bg-bg-panel shadow-[var(--shadow-pop)]">
          <label className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
            <Search size={14} className="text-text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, abbreviation or town (e.g. UNILAG, Nsukka)"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            {loading && <Loader2 size={14} className="animate-spin text-text-muted" />}
          </label>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {error && <li className="px-3 py-3 text-sm text-status-danger">{error}</li>}
            {!loading && !error && results.length === 0 && (
              <li className="px-3 py-3 text-sm text-text-muted">No institution matches “{query}”.</li>
            )}
            {results.map((inst) => (
              <li key={inst.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value?.id === inst.id}
                  onClick={() => { onChange(inst); setOpen(false); setQuery(""); }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-bg-panel-alt"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-text-primary">{institutionLabel(inst)}</span>
                    <span className="block text-[11px] text-text-muted">
                      {[inst.abbreviation, inst.type, inst.ownership, inst.state].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {value?.id === inst.id && <Check size={15} className="mt-0.5 text-accent" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Institution → Faculty → Department → Programme, each list driven by the one above.
 * `value` / `onChange` use { institution, facultyId, departmentId, programId } plus the
 * official names (faculty, department, program) that are stored on the profile.
 */
export default function AcademicPicker({ value, onChange, required = true }) {
  const institution = value?.institution || null;
  const { tree, loading, error } = useInstitutionTree(institution?.id);
  const faculties = tree?.faculties || EMPTY_FACULTIES;
  const faculty = faculties.find((f) => f.id === value?.facultyId) || null;
  const departments = faculty?.departments || [];
  const department = departments.find((d) => d.id === value?.departmentId) || null;
  const programs = department?.programs || [];
  const derived = Boolean(tree?.derivedDepartments || department?.derived);
  const [requested, setRequested] = useState(false);

  const set = (patch) => onChange({ ...value, ...patch });

  // A department named after its only programme: pick the programme for the student.
  useEffect(() => {
    if (department && programs.length === 1 && value?.programId !== programs[0].id) {
      set({ programId: programs[0].id, program: programs[0].name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department?.id, programs.length]);

  const sortedFaculties = useMemo(
    () => [...faculties].sort((a, b) => (a.kind === "unassigned") - (b.kind === "unassigned")),
    [faculties]
  );

  async function requestCatalog() {
    try {
      await requestsApi.create({
        type: "catalog_addition",
        title: `Add faculties and programmes for ${institution.name}`,
        body: `A student asked for the academic structure of ${institution.name} (${institution.abbreviation || "no abbreviation"}).`,
        meta: { institutionId: institution.id },
      });
      setRequested(true);
      notify.success("Thanks. We've asked the team to add your institution's programmes.");
    } catch (err) {
      notify.error(err.message || "Couldn't send the request");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Institution</label>
        <InstitutionCombobox
          value={institution}
          onChange={(inst) => onChange({ institution: inst, facultyId: "", faculty: "", departmentId: "", department: "", programId: "", program: "" })}
        />
      </div>

      {institution && loading && (
        <p className="flex items-center gap-2 text-xs text-text-muted"><Loader2 size={13} className="animate-spin" /> Loading faculties…</p>
      )}
      {institution && error && <p className="text-xs text-status-danger">{error}</p>}

      {institution && tree && faculties.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-bg-panel-alt p-3 text-xs text-text-secondary">
          We don't have faculties and programmes for this institution yet.
          {requested ? (
            <p className="mt-1 font-semibold text-text-primary">Request sent.</p>
          ) : (
            <button type="button" onClick={requestCatalog} className="mt-2 block font-semibold text-accent hover:underline">Ask us to add them</button>
          )}
        </div>
      )}

      {faculties.length > 0 && (
        <>
          <div>
            <label className={labelCls}>Faculty</label>
            <select
              required={required}
              value={value?.facultyId || ""}
              onChange={(e) => {
                const f = faculties.find((x) => x.id === e.target.value);
                set({ facultyId: f?.id || "", faculty: f?.name || "", departmentId: "", department: "", programId: "", program: "" });
              }}
              className={selectCls}
            >
              <option value="" disabled>Select your faculty</option>
              {sortedFaculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.kind === "unassigned" ? "Other / unassigned programmes" : prettyName(f.name)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Department</label>
            <select
              required={required}
              disabled={!faculty}
              value={value?.departmentId || ""}
              onChange={(e) => {
                const d = departments.find((x) => x.id === e.target.value);
                set({ departmentId: d?.id || "", department: d?.name || "", programId: "", program: "" });
              }}
              className={selectCls}
            >
              <option value="">{faculty ? "Select your department" : "Select faculty first"}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{prettyName(d.name)}</option>)}
            </select>
            {derived && faculty && (
              <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-text-muted">
                <Info size={11} className="mt-0.5 shrink-0" />
                Your institution's official list doesn't name departments, so each department is listed under its programme.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Programme</label>
            <select
              required={required && programs.length > 0}
              disabled={!department || programs.length === 0}
              value={value?.programId || ""}
              onChange={(e) => {
                const p = programs.find((x) => x.id === e.target.value);
                set({ programId: p?.id || "", program: p?.name || "" });
              }}
              className={selectCls}
            >
              <option value="">{department ? "Select your programme" : "Select department first"}</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {prettyName(p.name)}{p.status === "pending" ? " (pending approval)" : ""}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
