import { useState } from "react";
import { useAcademicCatalog } from "../hooks/useAcademicCatalog";

const LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "Postgraduate"];

export default function EditUserModal({ user, onSave, onCancel, busy }) {
  const [name, setName] = useState(user.name || "");
  const [faculty, setFaculty] = useState(user.faculty || "");
  const [department, setDepartment] = useState(user.department || "");
  const [program, setProgram] = useState(user.program || "");
  const [level, setLevel] = useState(user.level || "");
  const [phone, setPhone] = useState(user.phone || "");

  const { faculties, departmentsFor, programsFor } = useAcademicCatalog();
  const departmentOptions = departmentsFor(faculty);
  const programOptions = programsFor(department);

  function handleFacultyChange(value) {
    setFaculty(value);
    setDepartment("");
    setProgram("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ name: name.trim(), faculty, department, program, level, phone: phone.trim() });
  }

  const fieldClass =
    "w-full rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Faculty</label>
        <select value={faculty} onChange={(e) => handleFacultyChange(e.target.value)} className={fieldClass}>
          <option value="">Select faculty</option>
          {faculties.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Program</label>
        <select
          value={program}
          disabled={!department || programOptions.length === 0}
          onChange={(e) => setProgram(e.target.value)}
          className={`${fieldClass} disabled:opacity-60`}
        >
          <option value="">{programOptions.length ? "Select program" : "Program not yet listed"}</option>
          {programOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Department</label>
        <select
          value={department}
          disabled={!faculty}
          onChange={(e) => setDepartment(e.target.value)}
          className={`${fieldClass} disabled:opacity-60`}
        >
          <option value="">Select department</option>
          {departmentOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Level</label>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className={fieldClass}>
          <option value="">Select level</option>
          {LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}