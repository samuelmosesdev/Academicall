import { useCallback, useEffect, useState } from "react";
import {
  Archive, ArchiveRestore, Building2, ChevronRight, Layers, Link2, Loader2, Pencil, Plus, Trash2, Unlink,
} from "lucide-react";
import { academicsApi } from "../../lib/api";
import { appConfirm, notify } from "../../lib/dialogs";
import { EmptyState, SearchField } from "../ui";
import Modal from "../Modal";
import { FormModal } from "./AcademicForms";
import { courseFields } from "../../data/academicOptions";

/**
 * Faculties → departments → programmes for one institution, with each
 * department's assigned courses and each programme's curriculum links.
 */
const plural = (n = 0, w) => `${(n || 0).toLocaleString()} ${w}${n === 1 ? "" : "s"}`;

function RowActions({ item, onRename, onToggle, onDelete, canDelete }) {
  return (
    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="acx-icon-btn" onClick={onRename} aria-label={`Rename ${item.name}`} title="Rename"><Pencil size={13} /></button>
      <button type="button" className="acx-icon-btn" onClick={onToggle} aria-label={item.active ? `Archive ${item.name}` : `Restore ${item.name}`} title={item.active ? "Archive (hide from sign-up)" : "Restore"}>
        {item.active ? <Archive size={13} /> : <ArchiveRestore size={13} />}
      </button>
      {canDelete && <button type="button" className="acx-icon-btn is-danger" onClick={onDelete} aria-label={`Delete ${item.name}`} title="Delete permanently"><Trash2 size={13} /></button>}
    </div>
  );
}
function CoursePicker({ open, onClose, onPick, onCreate }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    if (q.trim().length < 2) { setRows([]); return undefined; }
    let live = true;
    setLoading(true);
    academicsApi.courses({ q: q.trim(), pageSize: 15 }).then((r) => live && setRows(r.courses || [])).catch(() => {}).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [q, open]);
  return (
    <Modal open={open} onClose={onClose} title="Assign a course" size="lg">
      <div className="space-y-3">
        <SearchField value={q} onChange={setQ} placeholder="Search the catalogue by code or title" autoFocus />
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {loading && <p className="flex items-center gap-2 py-3 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> Searching…</p>}
          {!loading && q.trim().length >= 2 && rows.length === 0 && <p className="py-3 text-sm text-text-muted">No course matches. Create it instead.</p>}
          {rows.map((c) => (
            <button key={c.id} type="button" className="acx-tree-row" onClick={() => onPick(c)}>
              <span className="acx-code w-20">{c.code}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{c.title}</span>
              <span className="text-xs text-text-muted">{[c.units != null && `${c.units}u`, c.level, c.category].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border-subtle pt-3">
          <span className="text-xs text-text-muted">Not in the catalogue?</span>
          <button type="button" className="acx-btn-ghost" onClick={onCreate}><Plus size={13} /> Create a new course</button>
        </div>
      </div>
    </Modal>
  );
}

function CurriculumPicker({ open, onClose, onPick }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!open) return;
    academicsApi.curricula({ q: q.trim(), pageSize: 20 }).then((r) => setRows(r.curricula || [])).catch(() => setRows([]));
  }, [q, open]);
  return (
    <Modal open={open} onClose={onClose} title="Link a national curriculum" size="lg">
      <div className="space-y-3">
        <SearchField value={q} onChange={setQ} placeholder="Search curricula, e.g. Computer Science" autoFocus />
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {rows.map((c) => (
            <button key={c.id} type="button" className="acx-tree-row" onClick={() => onPick(c)}>
              <Layers size={15} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text-primary">{c.name}</span><span className="text-xs text-text-muted">{c.edition}</span></span>
              <span className="acx-chip-sm">{c.tier.toUpperCase()}</span>
              <span className="text-xs text-text-muted">{plural(c._count.entries, "course")}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function InstitutionExplorer({ institution, isAdmin, onChanged }) {
  const [level, setLevel] = useState({ kind: "faculties" }); // faculties | departments(faculty) | department(faculty, department)
  const [items, setItems] = useState([]);
  const [extra, setExtra] = useState({ programmes: [], courses: [] });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // { title, fields, initial, submit }
  const [picker, setPicker] = useState(null); // "course" | { programme }

  const load = useCallback(async () => {
    setLoading(true);
    setItems([]);
    try {
      if (level.kind === "faculties") setItems((await academicsApi.faculties(institution.id)).faculties);
      else if (level.kind === "departments") setItems((await academicsApi.departments(level.faculty.id)).departments);
      else {
        const [p, c] = await Promise.all([academicsApi.programmes(level.department.id), academicsApi.departmentCourses(level.department.id)]);
        setExtra({ programmes: p.programmes, courses: c.courses });
      }
    } catch (err) {
      notify.error(err.message || "Couldn't load");
    } finally {
      setLoading(false);
    }
  }, [level, institution.id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => {
    try { await fn(); if (ok) notify.success(ok); await load(); onChanged?.(); } catch (err) { notify.error(err.message || "That didn't work"); }
  };

  const nameForm = (title, initial, submit, label = "Name") => setForm({
    title, initial: { name: initial || "" }, submitLabel: initial ? "Save" : "Add",
    fields: [{ name: "name", label, required: true, minLength: 2, maxLength: 200, wide: true }],
    submit: async (v) => { await submit(v); setForm(null); await load(); onChanged?.(); },
  });

  const confirmDelete = async (what, fn) => {
    if (!(await appConfirm(`Delete ${what} permanently? This can't be undone. Records still used by students can't be deleted; archive them instead.`, { tone: "danger", confirmLabel: "Delete" }))) return;
    run(fn, `${what} deleted`);
  };
  const toggle = (item, update) => run(() => update(item.id, { active: !item.active }), item.active ? `${item.name} archived` : `${item.name} restored`);

  const crumbs = (
    <nav className="acx-crumbs mb-3" aria-label="Breadcrumb">
      <button type="button" className={level.kind === "faculties" ? "is-here" : ""} onClick={() => setLevel({ kind: "faculties" })}>Faculties</button>
      {level.faculty && <><ChevronRight size={12} /><button type="button" className={level.kind === "departments" ? "is-here" : ""} onClick={() => setLevel({ kind: "departments", faculty: level.faculty })}>{level.faculty.name}</button></>}
      {level.department && <><ChevronRight size={12} /><span className="is-here">{level.department.name}</span></>}
    </nav>
  );

  let body;
  if (loading) body = <div className="flex items-center gap-2 py-8 text-sm text-text-muted"><Loader2 size={15} className="animate-spin" /> Loading…</div>;
  else if (level.kind !== "department") {
    const isFac = level.kind === "faculties";
    body = (
      <>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text-primary">{isFac ? plural(items.length, "faculty").replace("facultys", "faculties") : plural(items.length, "department")}</h4>
          <button type="button" className="acx-btn !py-1.5 !text-xs" onClick={() => nameForm(isFac ? "Add a faculty" : `Add a department to ${level.faculty.name}`, "", (v) => (isFac ? academicsApi.createFaculty(institution.id, v) : academicsApi.createDepartment(level.faculty.id, v)))}>
            <Plus size={13} /> {isFac ? "Faculty" : "Department"}
          </button>
        </div>
        {items.length === 0 ? (
          <EmptyState icon={Building2} title={isFac ? "No faculties yet" : "No departments yet"} description="Add the first one to start building this institution's structure." className="!py-8" />
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => (
              <div key={it.id} role="button" tabIndex={0} className={`acx-tree-row cursor-pointer ${it.active ? "" : "is-off"}`}
                onClick={() => setLevel(isFac ? { kind: "departments", faculty: it } : { kind: "department", faculty: level.faculty, department: it })}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text-primary">{it.name}</span>
                  <span className="text-xs text-text-muted">
                    {isFac ? plural(it._count.departments, "department") : `${plural(it._count.programs, "programme")} · ${plural(it._count.courses, "assigned course")}`}
                    {" · "}{plural(it.students || 0, "student")}{!it.active && " · archived"}{it.derived && " · named after its programme"}
                  </span>
                </span>
                <RowActions
                  item={it}
                  canDelete={isAdmin}
                  onRename={() => nameForm(`Rename ${it.name}`, it.name, (v) => (isFac ? academicsApi.updateFaculty(it.id, v) : academicsApi.updateDepartment(it.id, v)))}
                  onToggle={() => toggle(it, isFac ? academicsApi.updateFaculty : academicsApi.updateDepartment)}
                  onDelete={() => confirmDelete(it.name, () => (isFac ? academicsApi.deleteFaculty(it.id) : academicsApi.deleteDepartment(it.id)))}
                />
                <ChevronRight size={15} className="text-text-muted" />
              </div>
            ))}
          </div>
        )}
      </>
    );
  } else {
    const dep = level.department;
    body = (
      <div className="space-y-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-primary">{plural(extra.programmes.length, "programme")}</h4>
            <button type="button" className="acx-btn !py-1.5 !text-xs" onClick={() => setForm({
              title: `Add a programme to ${dep.name}`, submitLabel: "Add", initial: {},
              fields: [
                { name: "name", label: "Programme name", required: true, minLength: 2, maxLength: 200, wide: true, placeholder: "B.Sc. Computer Science" },
                { name: "award", label: "Award", maxLength: 40, placeholder: "B.Sc." },
                { name: "duration", label: "Duration", maxLength: 40, placeholder: "4 years" },
              ],
              submit: async (v) => { await academicsApi.createProgramme(dep.id, v); setForm(null); await load(); },
            })}><Plus size={13} /> Programme</button>
          </div>
          {extra.programmes.length === 0 ? <p className="rounded-xl bg-bg-panel-alt px-3 py-4 text-sm text-text-muted">No programmes. Students pick a programme when they set up their profile.</p> : (
            <div className="space-y-2">
              {extra.programmes.map((p) => (
                <div key={p.id} className={`rounded-xl border border-border-subtle bg-bg-panel p-3 ${p.active ? "" : "opacity-60"}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">{p.name}</p>
                      <p className="text-xs text-text-muted">{[p.award, p.duration, plural(p.students || 0, "student"), !p.active && "archived"].filter(Boolean).join(" · ")}</p>
                    </div>
                    <RowActions
                      item={p}
                      canDelete={isAdmin}
                      onRename={() => setForm({
                        title: `Edit ${p.name}`, submitLabel: "Save", initial: { name: p.name, award: p.award || "", duration: p.duration || "" },
                        fields: [
                          { name: "name", label: "Programme name", required: true, minLength: 2, maxLength: 200, wide: true },
                          { name: "award", label: "Award", maxLength: 40 },
                          { name: "duration", label: "Duration", maxLength: 40 },
                        ],
                        submit: async (v) => { await academicsApi.updateProgramme(p.id, v); setForm(null); await load(); },
                      })}
                      onToggle={() => toggle(p, academicsApi.updateProgramme)}
                      onDelete={() => confirmDelete(p.name, () => academicsApi.deleteProgramme(p.id))}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {p.curricula.map((c) => (
                      <span key={c.id} className="acx-chip-sm !gap-1" title={`${c.edition || ""} · matched by ${c.matchedBy}`}>
                        <Layers size={11} /> {c.name}
                        <button type="button" className="ml-0.5 opacity-60 hover:opacity-100" aria-label={`Unlink ${c.name}`} onClick={async () => {
                          if (await appConfirm(`Unlink ${c.name} from ${p.name}? Its courses stop being suggested to these students. Courses already on their lists stay.`, { confirmLabel: "Unlink" })) run(() => academicsApi.unlinkCurriculum(p.id, c.id), "Curriculum unlinked");
                        }}><Unlink size={10} /></button>
                      </span>
                    ))}
                    <button type="button" className="acx-filter !py-0.5 !text-[0.7rem]" onClick={() => setPicker({ programme: p })}><Link2 size={11} /> Link curriculum</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-text-primary">Courses assigned to this department</h4>
              <p className="text-xs text-text-muted">Suggested to every student in {dep.name}, on top of their programme's curriculum.</p>
            </div>
            <button type="button" className="acx-btn !py-1.5 !text-xs" onClick={() => setPicker("course")}><Plus size={13} /> Assign</button>
          </div>
          {extra.courses.length === 0 ? <p className="rounded-xl bg-bg-panel-alt px-3 py-4 text-sm text-text-muted">Nothing assigned yet.</p> : (
            <div className="acx-table-wrap">
              <table className="acx-table">
                <thead><tr><th>Code</th><th>Title</th><th>Level</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {extra.courses.map((l) => (
                    <tr key={l.id} className={l.course.archivedAt ? "is-muted" : ""}>
                      <td><span className="acx-code">{l.course.code}</span></td>
                      <td className="strong">{l.course.title}</td>
                      <td>{[l.level, l.semester].filter(Boolean).join(" · ") || "—"}</td>
                      <td>{l.status || "—"}</td>
                      <td className="num">
                        <button type="button" className="acx-icon-btn is-danger" aria-label={`Unassign ${l.course.code}`} onClick={async () => {
                          if (await appConfirm(`Stop suggesting ${l.course.code} to ${dep.name}? Students who already added it keep it.`, { confirmLabel: "Unassign" })) run(() => academicsApi.unassignCourse(dep.id, l.id), "Course unassigned");
                        }}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  const dep = level.department;
  const assignFields = [
    { name: "level", label: "Level", maxLength: 30, placeholder: "200 Level" },
    { name: "semester", label: "Semester", type: "select", options: [["1st", "First"], ["2nd", "Second"]] },
    { name: "status", label: "Status", type: "select", options: ["Compulsory", "Elective", "Required"] },
  ];

  return (
    <div>
      {crumbs}
      {body}
      {form && (
        <FormModal open title={form.title} fields={form.fields} initial={form.initial} submitLabel={form.submitLabel} onClose={() => setForm(null)} onSubmit={async (v) => { await form.submit(v); notify.success("Saved"); }} />
      )}
      <CoursePicker
        open={picker === "course"}
        onClose={() => setPicker(null)}
        onPick={(c) => { setPicker(null); setForm({
          title: `Assign ${c.code} to ${dep?.name}`, submitLabel: "Assign", initial: { level: c.level || "", semester: c.semester || "", status: "Compulsory" }, fields: assignFields,
          submit: async (v) => { await academicsApi.assignCourse(dep.id, { courseId: c.id, ...v }); setForm(null); await load(); },
        }); }}
        onCreate={() => { setPicker(null); setForm({
          title: `New course for ${dep?.name}`, submitLabel: "Create and assign", initial: {}, fields: [...courseFields.slice(0, 6), { name: "status", label: "Status", type: "select", options: ["Compulsory", "Elective", "Required"] }],
          submit: async (v) => {
            const { status, ...course } = v;
            await academicsApi.assignCourse(dep.id, { course, level: course.level, semester: course.semester, status });
            setForm(null); await load();
          },
        }); }}
      />
      <CurriculumPicker
        open={Boolean(picker?.programme)}
        onClose={() => setPicker(null)}
        onPick={(c) => { const p = picker.programme; setPicker(null); run(() => academicsApi.linkCurriculum(p.id, c.id), `${c.name} linked to ${p.name}`); }}
      />
    </div>
  );
}
