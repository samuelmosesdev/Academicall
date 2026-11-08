import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "../components/ui";
import { orgApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { appConfirm, notify } from "../lib/dialogs";
import TaskBoard from "../components/org/TaskBoard";
import TaskFormModal from "../components/org/TaskFormModal";
import { StatTile } from "../components/org/orgUi";
import { isOverdue } from "../components/org/orgHelpers";

/** Every task across the organisation: assign work, see who is stuck, filter by office or person. */
export default function AdminTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState(null);
  const [staff, setStaff] = useState([]);
  const [offices, setOffices] = useState([]);
  const [error, setError] = useState("");
  const [office, setOffice] = useState("");
  const [person, setPerson] = useState("");
  const [form, setForm] = useState(undefined); // undefined closed, null new, task = edit

  const load = useCallback(async () => {
    try {
      const [t, s, o] = await Promise.all([orgApi.tasks("all"), orgApi.staff(), orgApi.offices()]);
      setTasks(t.tasks || []); setStaff((s.staff || []).filter((x) => x.status !== "suspended")); setOffices(o.offices || []); setError("");
    } catch (err) { setError(err?.message || "Could not load tasks"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (tasks || []).filter((t) => (!office || t.office?.id === office) && (!person || t.assigneeId === person)), [tasks, office, person]);

  async function update(id, patch) {
    try { await orgApi.updateTask(id, patch); await load(); } catch (err) { notify.error(err?.message || "Could not update"); }
  }
  async function remove(task) {
    if (!(await appConfirm(`Delete “${task.title}”?`))) return;
    try { await orgApi.deleteTask(task.id); await load(); } catch (err) { notify.error(err?.message || "Could not delete"); }
  }

  if (error && !tasks) return <ErrorState title="Tasks unavailable" message={error} onRetry={load} />;
  if (!tasks) return <LoadingState message="Loading tasks…" />;
  const open = shown.filter((t) => t.status !== "done");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Staff tasks" description="Work assigned across the organisation."
        actions={<button type="button" className="acx-btn" onClick={() => setForm(null)} disabled={staff.length === 0}><Plus size={14} /> Assign task</button>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Open" value={open.length} />
        <StatTile label="Overdue" value={shown.filter(isOverdue).length} tone={shown.some(isOverdue) ? "bad" : ""} />
        <StatTile label="Blocked" value={shown.filter((t) => t.status === "blocked").length} tone={shown.some((t) => t.status === "blocked") ? "warn" : ""} />
        <StatTile label="Done" value={shown.filter((t) => t.status === "done").length} />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <select className="acx-select" value={office} onChange={(e) => setOffice(e.target.value)} aria-label="Office"><option value="">All offices</option>{offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <select className="acx-select" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person"><option value="">Everyone</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      {tasks.length === 0 ? (
        <EmptyState title="No tasks yet" description="Assign the first task to a staff member and it appears on their dashboard." />
      ) : (
        <TaskBoard tasks={shown} meId={user?.uid} showAssignee onUpdate={update} onEdit={(t) => setForm(t)} onDelete={remove} />
      )}
      <TaskFormModal open={form !== undefined} onClose={() => setForm(undefined)} assignees={staff} initial={form || null}
        onSave={async (payload) => { if (form) await orgApi.updateTask(form.id, payload); else await orgApi.createTask(payload); await load(); notify.success("Task saved"); }} />
    </div>
  );
}
