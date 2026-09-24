import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { defaultAcademicCatalog } from "../data/academicCatalog";
import { settingsApi } from "../lib/api";

const field = "w-full rounded-lg border border-border-subtle bg-bg-panel px-3 py-2 text-sm text-text-primary";

export default function AdminAcademicCatalog() {
  const [catalog, setCatalog] = useState(defaultAcademicCatalog);
  const [facultyName, setFacultyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    settingsApi.get("academicCatalog").then(({ value }) => {
      if (alive && value?.faculties?.length) setCatalog(value);
    }).catch(() => {}).finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, []);

  function updateFaculty(index, update) {
    setCatalog((current) => ({
      faculties: current.faculties.map((faculty, itemIndex) => itemIndex === index ? { ...faculty, ...update } : faculty),
    }));
  }

  function addFaculty(event) {
    event.preventDefault();
    const name = facultyName.trim();
    if (!name) return;
    if (catalog.faculties.some((faculty) => faculty.name.toLowerCase() === name.toLowerCase())) return;
    setCatalog((current) => ({ faculties: [...current.faculties, { name, departments: [] }] }));
    setFacultyName("");
  }

  function addDepartment(facultyIndex) {
    const faculty = catalog.faculties[facultyIndex];
    const name = window.prompt(`Department for ${faculty.name}`)?.trim();
    if (!name) return;
    updateFaculty(facultyIndex, { departments: [...faculty.departments, { name, programs: [] }] });
  }

  function addProgram(facultyIndex, departmentIndex) {
    const faculty = catalog.faculties[facultyIndex];
    const department = faculty.departments[departmentIndex];
    const name = window.prompt(`Program under ${department.name}`)?.trim();
    if (!name) return;
    updateFaculty(facultyIndex, {
      departments: faculty.departments.map((item, index) => index === departmentIndex ? { ...item, programs: [...(item.programs || []), name] } : item),
    });
  }

  async function save() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await settingsApi.update("academicCatalog", catalog);
      setMessage("Academic catalog saved.");
    } catch (err) {
      setError(err.message || "Could not save the catalog.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-lg font-semibold text-text-primary">Academic catalog</h1><p className="text-sm text-text-muted">Manage the faculty, department, and program choices used for student profiles and Course Rep assignments.</p></div>
        <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app disabled:opacity-60"><Save size={15} /> {busy ? "Saving…" : "Save catalog"}</button>
      </div>
      {message && <p className="rounded-lg bg-status-success/10 px-3 py-2 text-sm text-status-success">{message}</p>}
      {error && <p className="rounded-lg bg-status-danger/10 px-3 py-2 text-sm text-status-danger">{error}</p>}
      <form onSubmit={addFaculty} className="flex gap-2"><input className={field} value={facultyName} onChange={(event) => setFacultyName(event.target.value)} placeholder="Add a faculty or college" /><button className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm"><Plus size={15} /> Add faculty</button></form>
      <div className="space-y-4">
        {catalog.faculties.map((faculty, facultyIndex) => (
          <section key={`${faculty.name}-${facultyIndex}`} className="rounded-xl border border-border-subtle bg-bg-panel p-4">
            <div className="flex items-center gap-2"><input className={`${field} font-semibold`} value={faculty.name} onChange={(event) => updateFaculty(facultyIndex, { name: event.target.value })} /><button type="button" title="Remove faculty" onClick={() => setCatalog((current) => ({ faculties: current.faculties.filter((_, index) => index !== facultyIndex) }))} className="rounded-lg p-2 text-status-danger hover:bg-status-danger/10"><Trash2 size={15} /></button></div>
            <div className="mt-3 space-y-2 pl-3">
              {(faculty.departments || []).map((department, departmentIndex) => <div key={`${department.name}-${departmentIndex}`} className="rounded-lg border border-border-subtle/70 p-3"><div className="flex items-center gap-2"><input className={field} value={department.name} onChange={(event) => updateFaculty(facultyIndex, { departments: faculty.departments.map((item, index) => index === departmentIndex ? { ...item, name: event.target.value } : item) })} /><button type="button" title="Remove department" onClick={() => updateFaculty(facultyIndex, { departments: faculty.departments.filter((_, index) => index !== departmentIndex) })} className="rounded-lg p-2 text-status-danger hover:bg-status-danger/10"><Trash2 size={15} /></button></div><div className="mt-2 flex flex-wrap gap-1.5">{(department.programs || []).map((program, programIndex) => <span key={`${program}-${programIndex}`} className="inline-flex items-center gap-1 rounded-full bg-bg-panel-alt px-2 py-1 text-xs text-text-secondary">{program}<button type="button" title="Remove program" onClick={() => updateFaculty(facultyIndex, { departments: faculty.departments.map((item, index) => index === departmentIndex ? { ...item, programs: item.programs.filter((_, index) => index !== programIndex) } : item) })} className="text-status-danger">×</button></span>)}<button type="button" onClick={() => addProgram(facultyIndex, departmentIndex)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-subtle px-2 py-1 text-xs text-accent"><Plus size={12} /> program</button></div></div>)}
              <button type="button" onClick={() => addDepartment(facultyIndex)} className="inline-flex items-center gap-1 text-xs font-medium text-accent"><Plus size={13} /> department</button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
