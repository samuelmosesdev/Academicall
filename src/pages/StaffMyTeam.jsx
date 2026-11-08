import { useCallback, useEffect, useState } from "react";
import { Plus, Mail } from "lucide-react";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "../components/ui";
import { orgApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useQuietPoll } from "../hooks/useQuietPoll";
import { appConfirm, notify } from "../lib/dialogs";
import TaskBoard from "../components/org/TaskBoard";
import TaskFormModal from "../components/org/TaskFormModal";
import { RoleChip, StaffAvatar, StatTile } from "../components/org/orgUi";

const seen = (v) => { if (!v) return "Never signed in"; const d = Math.floor((Date.now() - new Date(v)) / 864e5); return d <= 0 ? "Active today" : `Seen ${d}d ago`; };

/** For Directors, HODs and supervisors: the staff under you, their workload, and the tasks you've handed out. */
export default function StaffMyTeam() {
  const { user } = useAuth();
  const [team, setTeam] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(undefined);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([orgApi.staff(), orgApi.tasks("team")]);
      setTeam((s.staff || []).filter((x) => x.status !== "suspended")); setTasks(t.tasks || []); setError("");
    } catch (err) { setError(err?.message || "Could not load your team"); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useQuietPoll(load, { interval: 60_000 });

  async function update(id, patch) { try { await orgApi.updateTask(id, patch); await load(); } catch (err) { notify.error(err?.message || "Could not update"); } }
  async function remove(task) {
    if (!(await appConfirm(`Delete “${task.title}”?`))) return;
    try { await orgApi.deleteTask(task.id); await load(); } catch (err) { notify.error(err?.message || "Could not delete"); }
  }

  if (error && !team) return <ErrorState title="Team unavailable" message={error} onRetry={load} />;
  if (!team) return <LoadingState message="Loading your team…" />;
  const shown = filter ? tasks.filter((t) => t.assigneeId === filter) : tasks;
  const late = tasks.filter((t) => t.status !== "done" && t.dueAt && new Date(t.dueAt) < new Date()).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="My team" description="The staff you supervise and the work you've given them."
        actions={<button type="button" className="acx-btn" onClick={() => setForm(null)} disabled={team.length === 0}><Plus size={14} /> Assign task</button>} />
      {team.length === 0 ? <EmptyState title="Nobody reports to you yet" description="An admin assigns your team by making you head of an office or your staff's supervisor." /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Team members" value={team.length} />
            <StatTile label="Open tasks" value={tasks.filter((t) => t.status !== "done").length} />
            <StatTile label="Overdue" value={late} tone={late ? "bad" : ""} />
            <StatTile label="Blocked" value={tasks.filter((t) => t.status === "blocked").length} tone={tasks.some((t) => t.status === "blocked") ? "warn" : ""} />
          </div>
          <section aria-label="Team" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {team.map((m) => (
              <button key={m.id} type="button" onClick={() => setFilter(filter === m.id ? "" : m.id)}
                className={`acx-card !p-4 text-left transition ${filter === m.id ? "!border-accent" : "hover:shadow-md"}`}>
                <div className="flex items-center gap-3">
                  <StaffAvatar person={m} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{m.name || m.email}</p>
                    <p className="truncate text-xs text-text-muted">{m.positionTitle || "Staff"}</p>
                  </div>
                  <RoleChip orgRole={m.orgRole} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
                  <span><span className="num text-base text-text-primary">{m.openTasks}</span> open{m.overdueTasks > 0 && <span className="acx-chip-sm is-danger ml-1.5">{m.overdueTasks} late</span>}</span>
                  <span className="text-text-muted">{m.mustChangePassword ? "Not signed in yet" : seen(m.lastActiveAt)}</span>
                </div>
                <p className="mt-1.5 flex items-center gap-1 truncate text-[0.7rem] text-text-muted"><Mail size={11} />{m.email}</p>
              </button>
            ))}
          </section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">{filter ? `Tasks for ${team.find((t) => t.id === filter)?.name}` : "All team tasks"}</h2>
            {filter && <button type="button" className="acx-btn-ghost" onClick={() => setFilter("")}>Show everyone</button>}
          </div>
          <TaskBoard tasks={shown} meId={user?.uid} showAssignee onUpdate={update} onEdit={(t) => setForm(t)} onDelete={remove} />
        </>
      )}
      <TaskFormModal open={form !== undefined} onClose={() => setForm(undefined)} assignees={team} initial={form || null}
        onSave={async (payload) => { if (form) await orgApi.updateTask(form.id, payload); else await orgApi.createTask(payload); await load(); notify.success("Task saved"); }} />
    </div>
  );
}
