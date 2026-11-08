import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, UserRound, CheckCircle2, Target } from "lucide-react";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "../components/ui";
import { orgApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useQuietPoll } from "../hooks/useQuietPoll";
import { notify } from "../lib/dialogs";
import TaskBoard from "../components/org/TaskBoard";
import { StatTile, StaffAvatar, RoleChip } from "../components/org/orgUi";
import { isOverdue } from "../components/org/orgHelpers";
import { useStaffShell } from "../components/staff/StaffShellContext";

/** A staff member's own work: their position and duties, who they report to, and the tasks assigned to them. */
export default function StaffMyWork() {
  const { user } = useAuth();
  const { org } = useStaffShell();
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setTasks((await orgApi.tasks("mine")).tasks || []); setError(""); }
    catch (err) { setError(err?.message || "Could not load your tasks"); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useQuietPoll(load, { interval: 60_000 });

  async function update(id, patch) {
    try { await orgApi.updateTask(id, patch); await load(); } catch (err) { notify.error(err?.message || "Could not update"); }
  }

  if (error && !tasks) return <ErrorState title="Your work is unavailable" message={error} onRetry={load} />;
  if (!tasks) return <LoadingState message="Loading your work…" />;
  const open = tasks.filter((t) => t.status !== "done");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="My work" description={org?.positionTitle ? `${org.positionTitle}${org.office ? ` · ${org.office.name}` : ""}` : "Tasks assigned to you"} />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="grid grid-cols-3 gap-3 self-start">
          <StatTile label="Open" value={open.length} />
          <StatTile label="Overdue" value={tasks.filter(isOverdue).length} tone={tasks.some(isOverdue) ? "bad" : ""} />
          <StatTile label="Done" value={tasks.filter((t) => t.status === "done").length} />
        </div>
        <aside className="acx-card space-y-3 !p-4 lg:row-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Building2 size={15} className="text-accent" />{org?.office?.name || "No office assigned yet"}</div>
          {org?.office?.description && <p className="text-xs text-text-muted">{org.office.description}</p>}
          <div className="flex items-center gap-2"><RoleChip orgRole={org?.orgRole} /></div>
          <div className="border-t border-border-subtle pt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted"><UserRound size={12} /> Reports to</p>
            {org?.supervisor ? <div className="flex items-center gap-2 text-sm"><StaffAvatar person={org.supervisor} size={26} /><span><span className="block text-text-primary">{org.supervisor.name}</span><span className="block text-xs text-text-muted">{org.supervisor.positionTitle}</span></span></div>
              : org?.office?.head && org.office.head.id !== user?.uid ? <div className="flex items-center gap-2 text-sm"><StaffAvatar person={org.office.head} size={26} /><span className="text-text-primary">{org.office.head.name} <span className="text-xs text-text-muted">(office head)</span></span></div>
              : <p className="text-sm text-text-muted">Reports directly to the admin</p>}
          </div>
          {org?.duties?.length > 0 && (
            <div className="border-t border-border-subtle pt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted"><Target size={12} /> Your responsibilities</p>
              <ul className="space-y-1.5">{org.duties.map((d) => <li key={d} className="flex gap-2 text-sm text-text-secondary"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-accent" />{d}</li>)}</ul>
            </div>
          )}
          {org?.isSupervisor && <Link to="/agent/my-team" className="acx-btn-ghost w-full justify-center">Open my team</Link>}
        </aside>
        <div className="lg:col-start-1">
          {tasks.length === 0 ? <EmptyState title="No tasks right now" description="When an admin or your supervisor assigns you work, it shows up here and in your notifications." />
            : <TaskBoard tasks={tasks} meId={user?.uid} onUpdate={update} hideDone={tasks.every((t) => t.status !== "done")} />}
        </div>
      </div>
    </div>
  );
}
