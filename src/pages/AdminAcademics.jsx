import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  Archive, ArchiveRestore, BookOpen, Building2, FileSpreadsheet, GraduationCap, Layers, Library, Pencil, Plus, School, Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { roleOf } from "../lib/roles";
import { academicsApi } from "../lib/api";
import { appConfirm, notify } from "../lib/dialogs";
import { PageHeader, ErrorState, EmptyState, SearchField, SortTh, Pager, Drawer, SkeletonRows } from "../components/ui";
import { FormModal } from "../components/academics/AcademicForms";
import { institutionFields, courseFields, NG_STATES, INST_TYPES, OWNERSHIP } from "../data/academicOptions";
import InstitutionExplorer from "../components/academics/InstitutionExplorer";

/**
 * Academics: the platform's academic structure and course catalogue.
 * Institutions → faculties → departments → programmes, courses (national
 * catalogue + ones staff created), and the national curricula behind course
 * suggestions. Everything here is live data from /admin/academics.
 */
const TABS = [
  { id: "overview", label: "Overview", icon: Library },
  { id: "institutions", label: "Institutions", icon: School },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "curricula", label: "Curricula", icon: Layers },
];
const fmt = (n) => (n ?? 0).toLocaleString();

function useTable(fetcher, initial) {
  const [params, setParams] = useState({ page: 1, pageSize: 25, ...initial });
  const [state, setState] = useState({ rows: [], total: 0, loading: true, error: "" });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const r = await fetcher(params);
      setState({ rows: r.rows, total: r.total, loading: false, error: "" });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message || "Couldn't load" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);
  useEffect(() => { load(); }, [load]);
  const set = (patch) => setParams((p) => ({ ...p, ...patch, page: patch.page ?? 1 }));
  return { params, set, ...state, reload: load };
}

// ─── Overview ────────────────────────────────────────────────────────────────
function Overview({ onGo }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { academicsApi.summary().then(setS).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorState message={error} />;
  const tiles = [
    { n: s?.institutions, l: "Institutions", h: "Universities, polytechnics, colleges", tab: "institutions", tone: "is-ink" },
    { n: s?.faculties, l: "Faculties and schools", h: `${fmt(s?.departments)} departments` },
    { n: s?.programmes, l: "Programmes", h: `${fmt(s?.programmesWithCurriculum)} matched to a curriculum` },
    { n: s?.courses, l: "Courses", h: `${fmt(s?.catalogue)} from the national curricula`, tab: "courses", tone: "is-lemon" },
    { n: s?.curricula, l: "Curricula", h: "NUC CCMAS & BMAS, NBTE, NCCE", tab: "curricula" },
    { n: s?.assigned, l: "Department assignments", h: `${fmt(s?.archived)} archived courses` },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <button key={t.l} type="button" disabled={!t.tab} onClick={() => t.tab && onGo(t.tab)} className={`acx-stat text-left ${t.tone || ""} ${t.tab ? "transition hover:-translate-y-0.5" : "cursor-default"}`}>
            <div className="acx-stat-n">{s ? fmt(t.n) : "—"}</div>
            <div className="acx-stat-l">{t.l}</div>
            <div className="acx-stat-h">{t.h}</div>
          </button>
        ))}
      </div>
      <div className="acx-card">
        <div className="acx-card-head"><div><h3>How suggestions reach students</h3><p>What a student sees on their Courses page.</p></div></div>
        <ol className="grid gap-3 text-sm text-text-secondary md:grid-cols-3">
          <li className="rounded-xl bg-bg-panel-alt p-3"><b className="text-text-primary">1. Programme curriculum.</b> Each programme is linked to its national course list (matched from JAMB names). Link or unlink one from a department's programmes.</li>
          <li className="rounded-xl bg-bg-panel-alt p-3"><b className="text-text-primary">2. Department courses.</b> Courses you assign to a department are suggested to everyone in it, ahead of the national list.</li>
          <li className="rounded-xl bg-bg-panel-alt p-3"><b className="text-text-primary">3. Retire, don't delete.</b> Archived courses stop being suggested but stay on the lists of students who added them.</li>
        </ol>
      </div>
    </div>
  );
}

// ─── Institutions ────────────────────────────────────────────────────────────
function Institutions({ isAdmin }) {
  const t = useTable(async (p) => {
    const r = await academicsApi.institutions(p);
    return { rows: r.institutions, total: r.total };
  }, { sort: "name", dir: "asc", status: "active" });
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);

  const refreshOpen = async (id) => {
    try { setOpen((await academicsApi.institution(id)).institution); } catch { /* ignore */ }
  };
  async function archive(inst) {
    const next = !inst.active;
    if (!next && !(await appConfirm(`Archive ${inst.displayName || inst.name}? It disappears from sign-up and pickers. Students already there keep their profiles.`, { confirmLabel: "Archive" }))) return;
    try { await academicsApi.updateInstitution(inst.id, { active: next }); notify.success(next ? "Restored" : "Archived"); t.reload(); refreshOpen(inst.id); } catch (e) { notify.error(e.message); }
  }
  async function remove(inst) {
    if (!(await appConfirm(`Delete ${inst.displayName || inst.name} and all its faculties, departments and programmes? This can't be undone.`, { tone: "danger", confirmLabel: "Delete permanently" }))) return;
    try { await academicsApi.deleteInstitution(inst.id); notify.success("Institution deleted"); setOpen(null); t.reload(); } catch (e) { notify.error(e.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={t.params.q} onChange={(q) => t.set({ q })} placeholder="Search name or abbreviation" className="w-full sm:w-auto sm:min-w-[17rem] sm:flex-1 lg:max-w-sm" />
        <select className="acx-select" value={t.params.type || ""} onChange={(e) => t.set({ type: e.target.value })} aria-label="Type">
          <option value="">All types</option>{INST_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="acx-select" value={t.params.ownership || ""} onChange={(e) => t.set({ ownership: e.target.value })} aria-label="Ownership">
          <option value="">Any ownership</option>{OWNERSHIP.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select className="acx-select" value={t.params.state || ""} onChange={(e) => t.set({ state: e.target.value })} aria-label="State">
          <option value="">All states</option>{NG_STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="acx-seg">
          {[["active", "Active"], ["archived", "Archived"], ["", "All"]].map(([v, l]) => <button key={l} type="button" className={(t.params.status || "") === v ? "is-on" : ""} onClick={() => t.set({ status: v })}>{l}</button>)}
        </div>
        <button type="button" className="acx-btn ml-auto" onClick={() => setForm({ mode: "create" })}><Plus size={14} /> Institution</button>
      </div>

      {t.error ? <ErrorState message={t.error} onRetry={t.reload} /> : (
        <div className="acx-table-wrap">
          <table className="acx-table">
            <thead>
              <tr>
                <SortTh k="name" sort={{ key: t.params.sort, dir: t.params.dir }} onSort={(s) => t.set({ sort: s.key, dir: s.dir })}>Institution</SortTh>
                <SortTh k="abbreviation" sort={{ key: t.params.sort, dir: t.params.dir }} onSort={(s) => t.set({ sort: s.key, dir: s.dir })}>Code</SortTh>
                <SortTh k="type" sort={{ key: t.params.sort, dir: t.params.dir }} onSort={(s) => t.set({ sort: s.key, dir: s.dir })}>Type</SortTh>
                <th className="hidden md:table-cell">Ownership</th>
                <SortTh k="state" sort={{ key: t.params.sort, dir: t.params.dir }} onSort={(s) => t.set({ sort: s.key, dir: s.dir })} className="hidden md:table-cell">State</SortTh>
                <th className="num">Faculties</th>
                <th className="num">Students</th>
              </tr>
            </thead>
            <tbody>
              {t.loading ? <SkeletonRows cols={7} /> : t.rows.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={School} title="No institutions match" description="Try another search or filter." className="!border-0 !py-10" /></td></tr>
              ) : t.rows.map((i) => (
                <tr key={i.id} className={`cursor-pointer ${i.active ? "" : "is-muted"}`} onClick={() => refreshOpen(i.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && refreshOpen(i.id)}>
                  <td className="strong max-w-[22rem]"><span className="line-clamp-2">{i.displayName || i.name}</span>{i.displayName && <span className="block truncate text-xs font-normal text-text-muted">{i.name}</span>}</td>
                  <td><span className="acx-code">{i.abbreviation || "—"}</span></td>
                  <td>{i.type || "—"}</td>
                  <td className="hidden md:table-cell">{i.ownership || "—"}</td>
                  <td className="hidden md:table-cell">{i.state || "—"}</td>
                  <td className="num">{fmt(i._count.faculties)}</td>
                  <td className="num">{fmt(i._count.users)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={t.params.page} pageSize={t.params.pageSize} total={t.total} onPage={(page) => t.set({ page })} onPageSize={(pageSize) => t.set({ pageSize })} />

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        subtitle={[open?.abbreviation, open?.type, open?.state].filter(Boolean).join(" · ")}
        title={open?.displayName || open?.name}
        actions={open && (
          <>
            <button type="button" className="acx-icon-btn" onClick={() => setForm({ mode: "edit", inst: open })} aria-label="Edit details" title="Edit details"><Pencil size={14} /></button>
            <button type="button" className="acx-icon-btn" onClick={() => archive(open)} aria-label={open.active ? "Archive" : "Restore"} title={open.active ? "Archive" : "Restore"}>{open.active ? <Archive size={14} /> : <ArchiveRestore size={14} />}</button>
            {isAdmin && <button type="button" className="acx-icon-btn is-danger" onClick={() => remove(open)} aria-label="Delete" title="Delete permanently"><Trash2 size={14} /></button>}
          </>
        )}
      >
        {open && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[["Faculties", open._count.faculties], ["Students", open._count.users], ["Study groups", open._count.studyGroups], ["Status", open.active ? "Active" : "Archived"]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-bg-panel-alt px-3 py-2"><dt className="text-[0.7rem] text-text-muted">{k}</dt><dd className="font-semibold text-text-primary">{typeof v === "number" ? fmt(v) : v}</dd></div>
              ))}
            </dl>
            <p className="text-xs text-text-muted">{[open.name, open.ownership, open.category, open.source === "admin" ? "added by staff" : open.source === "ibass" ? "from JAMB IBASS" : open.source].filter(Boolean).join(" · ")}</p>
            <InstitutionExplorer key={open.id} institution={open} isAdmin={isAdmin} onChanged={() => refreshOpen(open.id)} />
          </div>
        )}
      </Drawer>

      {form && (
        <FormModal
          open
          title={form.mode === "create" ? "Add an institution" : `Edit ${form.inst.displayName || form.inst.name}`}
          fields={institutionFields}
          initial={form.mode === "edit" ? Object.fromEntries(institutionFields.map((f) => [f.name, form.inst[f.name] || ""])) : { type: "Degree" }}
          submitLabel={form.mode === "create" ? "Add institution" : "Save"}
          onClose={() => setForm(null)}
          onSubmit={async (v) => {
            if (form.mode === "create") {
              const r = await academicsApi.createInstitution(v);
              notify.success("Institution added");
              setForm(null); t.reload(); refreshOpen(r.institution.id);
            } else {
              await academicsApi.updateInstitution(form.inst.id, v);
              notify.success("Saved");
              setForm(null); t.reload(); refreshOpen(form.inst.id);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Courses ─────────────────────────────────────────────────────────────────
function Courses({ isAdmin, base }) {
  const t = useTable(async (p) => {
    const r = await academicsApi.courses(p);
    return { rows: r.courses, total: r.total };
  }, { sort: "code", dir: "asc", status: "" });
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);
  const openCourse = async (id) => { try { setOpen((await academicsApi.course(id)).course); } catch (e) { notify.error(e.message); } };
  const sort = { key: t.params.sort, dir: t.params.dir };
  const onSort = (s) => t.set({ sort: s.key, dir: s.dir });

  async function archive(c) {
    const restore = Boolean(c.archivedAt);
    if (!restore && !(await appConfirm(`Archive ${c.code}? It stops being suggested. ${c._count?.enrollments || 0} students who have it keep it on their list.`, { confirmLabel: "Archive" }))) return;
    try { await (restore ? academicsApi.restoreCourse(c.id) : academicsApi.archiveCourse(c.id)); notify.success(restore ? "Restored" : "Archived"); t.reload(); openCourse(c.id); } catch (e) { notify.error(e.message); }
  }
  async function remove(c) {
    if (!(await appConfirm(`Delete ${c.code} ${c.title} permanently? Only possible when no student or material uses it.`, { tone: "danger", confirmLabel: "Delete permanently" }))) return;
    try { await academicsApi.deleteCourse(c.id); notify.success("Course deleted"); setOpen(null); t.reload(); } catch (e) { notify.error(e.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={t.params.q} onChange={(q) => t.set({ q })} placeholder="Search code, title or department" className="w-full sm:w-auto sm:min-w-[17rem] sm:flex-1 lg:max-w-sm" />
        <select className="acx-select" value={t.params.category || ""} onChange={(e) => t.set({ category: e.target.value })} aria-label="Tier">
          <option value="">All tiers</option><option value="Degree">Degree</option><option value="ND">ND / HND</option><option value="NCE">NCE</option>
        </select>
        <select className="acx-select" value={t.params.source || ""} onChange={(e) => t.set({ source: e.target.value })} aria-label="Source">
          <option value="">Any source</option><option value="catalogue">National curricula</option><option value="local">Created on Academicall</option>
        </select>
        <div className="acx-seg">
          {[["", "Active"], ["archived", "Archived"], ["all", "All"]].map(([v, l]) => <button key={l} type="button" className={(t.params.status || "") === v ? "is-on" : ""} onClick={() => t.set({ status: v })}>{l}</button>)}
        </div>
        <div className="flex gap-2 ml-auto">
          <Link to={`${base}/courses`} className="acx-btn-ghost" title="Spreadsheet and course-form import"><FileSpreadsheet size={14} /> Bulk import</Link>
          <button type="button" className="acx-btn" onClick={() => setForm({ mode: "create" })}><Plus size={14} /> Course</button>
        </div>
      </div>

      {t.error ? <ErrorState message={t.error} onRetry={t.reload} /> : (
        <div className="acx-table-wrap">
          <table className="acx-table">
            <thead>
              <tr>
                <SortTh k="code" sort={sort} onSort={onSort}>Code</SortTh>
                <SortTh k="title" sort={sort} onSort={onSort}>Title</SortTh>
                <th className="num">Units</th>
                <SortTh k="level" sort={sort} onSort={onSort} className="hidden md:table-cell">Level</SortTh>
                <th className="hidden lg:table-cell">Tier</th>
                <th className="num hidden md:table-cell">Curricula</th>
                <th className="num">Students</th>
              </tr>
            </thead>
            <tbody>
              {t.loading ? <SkeletonRows cols={7} /> : t.rows.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={BookOpen} title="No courses match" description="Try another search, or add the course." className="!border-0 !py-10" /></td></tr>
              ) : t.rows.map((c) => (
                <tr key={c.id} className={`cursor-pointer ${c.archivedAt ? "is-muted" : ""}`} onClick={() => openCourse(c.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openCourse(c.id)}>
                  <td><span className="acx-code">{c.code || "—"}</span></td>
                  <td className="strong max-w-[26rem]"><span className="line-clamp-2">{c.title}</span>{c.department && <span className="block truncate text-xs font-normal text-text-muted">{c.department}</span>}</td>
                  <td className="num">{c.units ?? "—"}</td>
                  <td className="hidden md:table-cell">{[c.level, c.semester].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="hidden lg:table-cell">{c.category || (c.source === "catalogue" ? "—" : "Local")}</td>
                  <td className="num hidden md:table-cell">{fmt(c._count.curriculumEntries)}</td>
                  <td className="num">{fmt(c._count.enrollments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={t.params.page} pageSize={t.params.pageSize} total={t.total} onPage={(page) => t.set({ page })} onPageSize={(pageSize) => t.set({ pageSize })} />

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        subtitle={open && [open.code, open.category, open.source === "catalogue" ? "National curriculum" : "Created on Academicall"].filter(Boolean).join(" · ")}
        title={open?.title}
        actions={open && (
          <>
            <button type="button" className="acx-icon-btn" onClick={() => setForm({ mode: "edit", course: open })} aria-label="Edit" title="Edit"><Pencil size={14} /></button>
            <button type="button" className="acx-icon-btn" onClick={() => archive(open)} aria-label={open.archivedAt ? "Restore" : "Archive"} title={open.archivedAt ? "Restore" : "Archive"}>{open.archivedAt ? <ArchiveRestore size={14} /> : <Archive size={14} />}</button>
            {isAdmin && <button type="button" className="acx-icon-btn is-danger" onClick={() => remove(open)} aria-label="Delete" title="Delete permanently"><Trash2 size={14} /></button>}
          </>
        )}
      >
        {open && (
          <div className="space-y-5">
            {open.archivedAt && <div className="acx-callout"><Archive size={16} className="mt-0.5" /> Archived {new Date(open.archivedAt).toLocaleDateString()}. Not suggested to students.</div>}
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[["Units", open.units ?? "—"], ["Level", open.level || "—"], ["Semester", open.semester || "—"], ["Students", fmt(open._count.enrollments)]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-bg-panel-alt px-3 py-2"><dt className="text-[0.7rem] text-text-muted">{k}</dt><dd className="font-semibold text-text-primary">{v}</dd></div>
              ))}
            </dl>
            {open.description && <p className="text-sm text-text-secondary">{open.description}</p>}
            <section>
              <h4 className="mb-2 text-sm font-semibold text-text-primary">In {open.curriculumEntries.length} curriculum list{open.curriculumEntries.length === 1 ? "" : "s"}</h4>
              {open.curriculumEntries.length === 0 ? <p className="text-sm text-text-muted">Not part of a national curriculum.</p> : (
                <ul className="space-y-1.5">
                  {open.curriculumEntries.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 rounded-xl bg-bg-panel-alt px-3 py-2 text-sm">
                      <Layers size={14} className="text-accent" />
                      <span className="min-w-0 flex-1 truncate text-text-primary">{e.curriculum.name}</span>
                      <span className="text-xs text-text-muted">{[e.level, e.semester, e.status, e.legacy && "older scheme"].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h4 className="mb-2 text-sm font-semibold text-text-primary">Assigned to {open.departmentLinks.length} department{open.departmentLinks.length === 1 ? "" : "s"}</h4>
              {open.departmentLinks.length === 0 ? <p className="text-sm text-text-muted">Assign it from an institution's department.</p> : (
                <ul className="space-y-1.5">
                  {open.departmentLinks.map((l) => (
                    <li key={l.id} className="rounded-xl bg-bg-panel-alt px-3 py-2 text-sm">
                      <span className="font-semibold text-text-primary">{l.department.name}</span>
                      <span className="block text-xs text-text-muted">{l.department.faculty.name} · {l.department.faculty.institution.displayName || l.department.faculty.institution.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Drawer>

      {form && (
        <FormModal
          open
          size="lg"
          title={form.mode === "create" ? "Add a course" : `Edit ${form.course.code}`}
          fields={courseFields}
          note={form.mode === "edit" && form.course._count?.enrollments ? `${form.course._count.enrollments} students have this course. Changes to the code and title show on their lists.` : undefined}
          initial={form.mode === "edit" ? Object.fromEntries(courseFields.map((f) => [f.name, form.course[f.name] ?? ""])) : {}}
          submitLabel={form.mode === "create" ? "Add course" : "Save"}
          onClose={() => setForm(null)}
          onSubmit={async (v) => {
            if (form.mode === "create") {
              const r = await academicsApi.createCourse(v);
              notify.success(`${r.course.code} added`);
              setForm(null); t.reload(); openCourse(r.course.id);
            } else {
              await academicsApi.updateCourse(form.course.id, v);
              notify.success("Saved");
              setForm(null); t.reload(); openCourse(form.course.id);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Curricula ───────────────────────────────────────────────────────────────
function Curricula() {
  const t = useTable(async (p) => {
    const r = await academicsApi.curricula(p);
    return { rows: r.curricula, total: r.total };
  }, { pageSize: 30 });
  const [open, setOpen] = useState(null);
  const [legacy, setLegacy] = useState(false);
  const openCur = async (id) => { try { setOpen((await academicsApi.curriculum(id)).curriculum); } catch (e) { notify.error(e.message); } };
  const groups = useMemo(() => {
    if (!open) return [];
    const map = new Map();
    for (const e of open.entries.filter((x) => x.legacy === legacy)) {
      const k = `${e.level}|${e.semester || ""}`;
      if (!map.has(k)) map.set(k, { level: e.level, semester: e.semester, items: [] });
      map.get(k).items.push(e);
    }
    return [...map.values()];
  }, [open, legacy]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={t.params.q} onChange={(q) => t.set({ q })} placeholder="Search curricula" className="w-full sm:w-auto sm:min-w-[17rem] sm:flex-1 lg:max-w-sm" />
        <div className="acx-seg">
          {[["", "All"], ["degree", "Degree"], ["nd", "ND"], ["nce", "NCE"]].map(([v, l]) => <button key={l} type="button" className={(t.params.tier || "") === v ? "is-on" : ""} onClick={() => t.set({ tier: v })}>{l}</button>)}
        </div>
      </div>
      {t.error ? <ErrorState message={t.error} onRetry={t.reload} /> : (
        <div className="acx-table-wrap">
          <table className="acx-table">
            <thead><tr><th>Curriculum</th><th>Tier</th><th className="hidden md:table-cell">Edition</th><th className="num">Courses</th><th className="num">Programmes</th><th className="num hidden sm:table-cell">Institutions</th></tr></thead>
            <tbody>
              {t.loading ? <SkeletonRows cols={6} /> : t.rows.map((c) => (
                <tr key={c.id} className={`cursor-pointer ${c.active ? "" : "is-muted"}`} onClick={() => openCur(c.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openCur(c.id)}>
                  <td className="strong">{c.name}{c.general && <span className="acx-chip-sm ml-2">General studies</span>}</td>
                  <td>{c.tier.toUpperCase()}</td>
                  <td className="hidden max-w-[16rem] truncate md:table-cell">{c.edition || "—"}</td>
                  <td className="num">{fmt(c._count.entries)}</td>
                  <td className="num">{fmt(c._count.programs)}</td>
                  <td className="num hidden sm:table-cell">{fmt(c.institutions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={t.params.page} pageSize={t.params.pageSize} total={t.total} onPage={(page) => t.set({ page })} />

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        subtitle={open && `${open.tier.toUpperCase()} · ${fmt(open._count.programs)} programmes`}
        title={open?.name}
        actions={open && (
          <button type="button" className="acx-btn-ghost" onClick={async () => {
            if (open.active && !(await appConfirm(`Switch off ${open.name}? Its courses stop being suggested to ${fmt(open._count.programs)} programmes.`, { confirmLabel: "Switch off" }))) return;
            try { await academicsApi.updateCurriculum(open.id, { active: !open.active }); notify.success(open.active ? "Switched off" : "Switched on"); openCur(open.id); t.reload(); } catch (e) { notify.error(e.message); }
          }}>{open.active ? <><Archive size={13} /> Switch off</> : <><ArchiveRestore size={13} /> Switch on</>}</button>
        )}
      >
        {open && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{legacy ? open.legacyEdition : open.edition}</p>
            {open.legacyEdition && (
              <div className="acx-seg">
                <button type="button" className={!legacy ? "is-on" : ""} onClick={() => setLegacy(false)}>Current</button>
                <button type="button" className={legacy ? "is-on" : ""} onClick={() => setLegacy(true)}>Older (BMAS)</button>
              </div>
            )}
            {groups.map((g) => (
              <div key={`${g.level}-${g.semester}`}>
                <div className="acx-group-label"><span>{g.level}{g.semester ? ` · ${g.semester} semester` : ""}</span><span className="normal-case tracking-normal">{g.items.reduce((s, e) => s + (e.units || 0), 0)} units</span></div>
                <div className="acx-table-wrap">
                  <table className="acx-table">
                    <tbody>
                      {g.items.map((e) => (
                        <tr key={e.id} className={e.course.archivedAt ? "is-muted" : ""}>
                          <td className="w-24"><span className="acx-code">{e.course.code}</span></td>
                          <td className="strong">{e.course.title}</td>
                          <td className="num w-14">{e.units ?? "—"}</td>
                          <td className="w-28 text-xs">{e.status || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-sm text-text-muted">No courses in this list.</p>}
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default function AdminAcademics() {
  const { profile } = useAuth();
  const location = useLocation();
  const base = location.pathname.startsWith("/agent") ? "/agent" : "/admin";
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((x) => x.id === params.get("tab")) ? params.get("tab") : "overview";
  const go = (id) => setParams(id === "overview" ? {} : { tab: id }, { replace: true });
  const isAdmin = roleOf(profile) === "admin";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Academics"
        description="Institutions, faculties, departments, programmes and the course catalogue that powers students' course suggestions."
        actions={<Link to={`${base}/governance/academic-catalog`} className="acx-btn-ghost"><GraduationCap size={14} /> UniAbuja sign-up list</Link>}
      />
      <div className="acx-tabs" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => go(id)}><Icon size={15} /> {label}</button>
        ))}
      </div>
      {tab === "overview" && <Overview onGo={go} />}
      {tab === "institutions" && <Institutions isAdmin={isAdmin} />}
      {tab === "courses" && <Courses isAdmin={isAdmin} base={base} />}
      {tab === "curricula" && <Curricula />}
      <p className="flex items-center gap-1.5 text-xs text-text-muted"><Building2 size={12} /> Changes are saved immediately and logged in the audit trail.</p>
    </div>
  );
}
